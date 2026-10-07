import { memo } from 'react';
import { lowPolyPreview } from '../../presets/lowPolyPreview.js';
import './assetPreview.css';

export default memo(function AssetPreview({ asset, kind = 'asset' }) {
  return <svg className="asset-preview low-poly-preview" viewBox="0 0 160 104" aria-hidden="true" focusable="false">
    <ellipse cx="80" cy="88" rx="56" ry="11" fill="#07151d" opacity=".22" />
    {lowPolyPreview(asset, kind).map((part, index) => part.text
      ? <text key={index} x={part.x} y={part.y} fill={part.fill} fontSize="12" fontWeight="800" textAnchor="middle">{part.text}</text>
      : <polygon key={index} points={part.points} fill={part.fill} stroke={part.fill} strokeWidth=".45" strokeLinejoin="round" />)}
  </svg>;
});
