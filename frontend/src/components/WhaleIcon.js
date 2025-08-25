import React from 'react';
import whaleImage from '../images/whale.png';

const WhaleIcon = ({ size = 24, className = '' }) => {
  // 你可以将这里替换为你的小鲸鱼图片路径
  // 或者直接使用图片URL
  // const whaleImage = '/images/whale.png'; // 将图片放在public/images/目录下
  
  return (
    <img 
      src={whaleImage} 
      alt="小鲸鱼" 
      width={size} 
      height={size} 
      className={className}
      style={{ 
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
      onError={(e) => {
        // 如果图片加载失败，显示一个简单的鲸鱼emoji作为备用
        e.target.style.display = 'none';
        const fallback = document.createElement('span');
        fallback.textContent = '🐋';
        fallback.style.fontSize = `${size}px`;
        fallback.style.verticalAlign = 'middle';
        e.target.parentNode.appendChild(fallback);
      }}
    />
  );
};

export default WhaleIcon;
