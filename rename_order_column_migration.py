import sqlite3
import os

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'judger.db'))

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Ensure foreign keys off during table rebuild
    cur.execute('PRAGMA foreign_keys=OFF')
    conn.commit()

    try:
        cur.execute('BEGIN')

        # Create new table with desired schema (order instead of order_num)
        cur.execute(
            '''
            CREATE TABLE IF NOT EXISTS assignment_problems_new (
                id INTEGER PRIMARY KEY,
                assignment_id INTEGER NOT NULL,
                problem_id INTEGER NOT NULL,
                "order" INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
                FOREIGN KEY(problem_id) REFERENCES problem(id) ON DELETE CASCADE
            )
            '''
        )

        # Detect whether old column exists
        cur.execute('PRAGMA table_info(assignment_problems)')
        cols = {row['name'] for row in cur.fetchall()}
        if 'order' in cols:
            print('Column already named "order". Nothing to do.')
            cur.execute('ROLLBACK')
            return

        if 'order_num' not in cols:
            raise RuntimeError('Neither order nor order_num exists on assignment_problems')

        # Copy data mapping order_num -> order
        cur.execute(
            'INSERT INTO assignment_problems_new (id, assignment_id, problem_id, "order", created_at)\n'
            'SELECT id, assignment_id, problem_id, order_num, created_at FROM assignment_problems'
        )

        # Drop old table and rename new
        cur.execute('DROP TABLE assignment_problems')
        cur.execute('ALTER TABLE assignment_problems_new RENAME TO assignment_problems')

        conn.commit()
        print('Migration completed: order_num -> order')
    except Exception as e:
        conn.rollback()
        raise
    finally:
        # Re-enable foreign keys
        cur.execute('PRAGMA foreign_keys=ON')
        conn.commit()
        conn.close()

if __name__ == '__main__':
    main()


