import os
import sqlite3
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'judger.db')

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cursor.fetchall()]
    return column in cols

def table_exists(cursor, table):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cursor.fetchone() is not None

def get_table_info(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    return cursor.fetchall()

def needs_course_rebuild_for_class_id_nullable(cursor):
    if not table_exists(cursor, 'course'):
        return False
    info = get_table_info(cursor, 'course')
    for cid, name, ctype, notnull, dflt, pk in info:
        if name == 'class_id':
            return notnull == 1
    return False

def main():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.isolation_level = None  # autocommit
    cursor = conn.cursor()

    try:
        cursor.execute('PRAGMA foreign_keys=OFF')

        # 0) Rebuild course table if class_id is NOT NULL
        try:
            if needs_course_rebuild_for_class_id_nullable(cursor):
                print('Rebuilding course table to make class_id NULLABLE and include teaching_class_name...')
                # fetch existing columns to detect presence of teaching_class_name
                has_teaching = column_exists(cursor, 'course', 'teaching_class_name')
                # Create new table schema
                cursor.execute(
                    """
                    CREATE TABLE course_new (
                        id INTEGER PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        description TEXT,
                        teacher_id INTEGER NOT NULL,
                        class_id INTEGER,
                        teaching_class_name VARCHAR(100),
                        created_at DATETIME,
                        updated_at DATETIME,
                        FOREIGN KEY(teacher_id) REFERENCES user(id),
                        FOREIGN KEY(class_id) REFERENCES class(id)
                    )
                    """
                )
                # Copy data (handle missing teaching_class_name)
                if has_teaching:
                    cursor.execute(
                        """
                        INSERT INTO course_new (id, name, description, teacher_id, class_id, teaching_class_name, created_at, updated_at)
                        SELECT id, name, description, teacher_id, class_id, teaching_class_name, created_at, updated_at FROM course
                        """
                    )
                else:
                    cursor.execute(
                        """
                        INSERT INTO course_new (id, name, description, teacher_id, class_id, teaching_class_name, created_at, updated_at)
                        SELECT id, name, description, teacher_id, class_id, NULL as teaching_class_name, created_at, updated_at FROM course
                        """
                    )
                # Replace table
                cursor.execute("DROP TABLE course")
                cursor.execute("ALTER TABLE course_new RENAME TO course")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_course_teacher ON course(teacher_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_course_class ON course(class_id)")
                print('Rebuilt course table successfully')
            else:
                print('Course table rebuild not required (class_id already nullable or table missing)')
        except Exception as e:
            print(f"Warning rebuilding course table: {e}")

        # 1) Add teaching_class_name to course if missing
        try:
            if table_exists(cursor, 'course') and not column_exists(cursor, 'course', 'teaching_class_name'):
                print('Adding column course.teaching_class_name...')
                cursor.execute("ALTER TABLE course ADD COLUMN teaching_class_name VARCHAR(100)")
                print('Added course.teaching_class_name')
            else:
                print('Column course.teaching_class_name already exists or course table missing, skipping')
        except Exception as e:
            print(f"Warning adding teaching_class_name: {e}")

        # 2) Create course_student_exclusion table if missing
        try:
            if not table_exists(cursor, 'course_student_exclusion'):
                print('Creating table course_student_exclusion...')
                cursor.execute(
                    """
                    CREATE TABLE course_student_exclusion (
                        id INTEGER PRIMARY KEY,
                        course_id INTEGER NOT NULL,
                        student_id INTEGER NOT NULL,
                        excluded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(course_id) REFERENCES course(id),
                        FOREIGN KEY(student_id) REFERENCES user(id)
                    )
                    """
                )
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cse_course ON course_student_exclusion(course_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_cse_student ON course_student_exclusion(student_id)")
                print('Created course_student_exclusion')
            else:
                print('Table course_student_exclusion already exists, skipping')
        except Exception as e:
            print(f"Warning creating course_student_exclusion: {e}")

        # 3) Integrity check
        cursor.execute('PRAGMA integrity_check')
        res = cursor.fetchone()
        print(f"Integrity check: {res[0]}")

    finally:
        cursor.execute('PRAGMA foreign_keys=ON')
        conn.close()
        print('Migration completed.')

if __name__ == '__main__':
    main()
