import { STREET_PROPS } from './streetscape.js';
import { EXPANSION_ASSETS } from './expansionAssets.js';

export const PRESETS = [
  { id: 'river', name: '강변 도시', subtitle: '강을 따라 자라는 도시', tag: 'RIVER VALLEY', color: '#7dbba7' },
  { id: 'coast', name: '해안 도시', subtitle: '해안과 도심이 만나는 곳', tag: 'COASTAL CITY', color: '#77bed0' },
  { id: 'alpine', name: '산골 마을', subtitle: '숲과 산으로 둘러싸인 마을', tag: 'MOUNTAIN TOWN', color: '#9eaf8a' },
  { id: 'blank', name: '빈 평지', subtitle: '빈 평지에서 자유롭게 설계', tag: 'OPEN SANDBOX', color: '#c2bc91' },
];

export const CATEGORIES = [
  { id: 'plot', name: '부지 조성', icon: 'plot', color: '#d9cca0' },
  { id: 'residential', name: '주거시설', icon: 'home', color: '#83bd96' },
  { id: 'commercial', name: '상업·업무', icon: 'building', color: '#77b7d6' },
  { id: 'industrial', name: '산업시설', icon: 'factory', color: '#a4b6ba' },
  { id: 'transport', name: '교통·주차', icon: 'road', color: '#9fbfb1' },
  { id: 'environment', name: '환경·자원', icon: 'tree', color: '#a4c2ad' },
  { id: 'landmark', name: '공공시설', icon: 'civic', color: '#c5acd7' },
  { id: 'power', name: '전력 시설', icon: 'power', color: '#e6c77e' },
  { id: 'water', name: '상하수도 시설', icon: 'water', color: '#83c9d5' },
  { id: 'nature', name: '공원 · 조경', icon: 'tree', color: '#a7bf76' },
  { id: 'road', name: '도로 · 교량', icon: 'road', color: '#b4c2cf' },
  { id: 'streetscape', name: '보행 · 편의시설', icon: 'road', color: '#b9ccb2' },
  { id: 'terrain', name: '지형 편집', icon: 'terrain', color: '#d0b58b' },
];

export const ASSETS = [
  ...EXPANSION_ASSETS,
  ...STREET_PROPS,
  { id: 'nuclear-plant', category: 'power', name: '원자력 발전소', detail: '발전 · 격납건물과 냉각탑', width: 28, depth: 24, height: 19, color: '#d3dcd3', people: 0 },
  { id: 'smart-factory', category: 'commercial', name: '스마트 공장', detail: '산업 수요 · 생산동과 옥상 태양광', width: 20, depth: 16, height: 8, color: '#a4b6ba', people: 0 },
  { id: 'house', category: 'residential', name: '단독주택', detail: '저밀도 주거 · 2층', width: 5, depth: 5, height: 4, color: '#e6dfcd', roof: '#a56850', people: 8 },
  { id: 'townhouses', category: 'residential', name: '연립주택', detail: '저층 주거 · 세 가구', width: 9, depth: 6, height: 5, color: '#d9cfb9', people: 24 },
  { id: 'apartment', category: 'residential', name: '중층 아파트', detail: '중밀도 주거 · 6층', width: 7, depth: 6, height: 11, color: '#d7dfd8', people: 48 },
  { id: 'tower', category: 'residential', name: '고층 아파트', detail: '고밀도 주거 · 14층', width: 7, depth: 7, height: 23, color: '#d8e4e4', people: 120 },
  { id: 'shop', category: 'commercial', name: '동네 상점', detail: '근린 상업 · 2층', width: 6, depth: 5, height: 4, color: '#e0c7a3', people: 0 },
  { id: 'cafe', category: 'commercial', name: '테라스 카페', detail: '근린 상업 · 테라스 좌석', width: 7, depth: 6, height: 4, color: '#d8b994', people: 0 },
  { id: 'office', category: 'commercial', name: '업무용 빌딩', detail: '업무 시설 · 18층', width: 8, depth: 7, height: 29, color: '#80a6af', people: 0 },
  { id: 'hotel', category: 'commercial', name: '호텔', detail: '관광 시설 · 10층', width: 10, depth: 6, height: 17, color: '#e2d9c7', people: 0 },
  { id: 'hall', category: 'landmark', name: '시청', detail: '도시 행정 · 공공시설', width: 10, depth: 8, height: 7, color: '#e5ded0', people: 0 },
  { id: 'school', category: 'landmark', name: '초등학교', detail: '교육 · 공공시설', width: 12, depth: 7, height: 5, color: '#dbb896', people: 0 },
  { id: 'hospital', category: 'landmark', name: '병원', detail: '의료 · 공공시설', width: 9, depth: 8, height: 10, color: '#e7ece5', people: 0 },
  { id: 'fire-station', category: 'landmark', name: '소방서', detail: '안전 · 차고와 출동 관제탑', width: 11, depth: 8, height: 6, color: '#d5d4c6', people: 0 },
  { id: 'power-plant', category: 'power', name: '일반 발전소', detail: '발전 · 터빈동과 배기탑', width: 12, depth: 10, height: 8, color: '#b6b9aa', people: 0 },
  { id: 'solar-farm', category: 'power', name: '태양광 발전소', detail: '재생에너지 · 태양광 패널', width: 10, depth: 8, height: 2, color: '#426a7b', people: 0 },
  { id: 'ess', category: 'power', name: '에너지 저장장치 (ESS)', detail: '에너지 저장 · 배터리 모듈', width: 8, depth: 6, height: 3, color: '#c7d5c8', people: 0 },
  { id: 'fast-charger', category: 'power', powerConsumer: true, name: '급속 충전소', detail: '전력 소비 · 지붕과 2면 충전 구역', width: 10, depth: 8, height: 4, color: '#78c6b5', people: 0 },
  { id: 'slow-charger', category: 'power', powerConsumer: true, name: '완속 충전기', detail: '전력 소비 · 주차면과 충전 기둥', width: 4, depth: 6, height: 2, color: '#78c6b5', people: 0 },
  { id: 'solar-carport', category: 'power', name: '태양광 주차장', detail: '재생에너지 · 주차장 지붕 태양광 발전', width: 12, depth: 10, height: 4, color: '#426a7b', people: 0 },
  { id: 'substation', category: 'power', name: '변전소', detail: '송전 · 변압기와 철구조물', width: 10, depth: 8, height: 7, color: '#9caeaf', people: 0 },
  { id: 'distribution', category: 'power', name: '배전 설비', detail: '배전 · 지역 전력 공급', width: 6, depth: 5, height: 4, color: '#b7c5b6', people: 0 },
  { id: 'wind-turbine', category: 'power', name: '풍력 발전기', detail: '재생에너지 · 회전 날개와 타워', width: 10, depth: 10, height: 18, color: '#dce5df', people: 0 },
  { id: 'transmission-tower', category: 'power', name: '송전탑', detail: '송전 · 철탑과 애자', width: 8, depth: 8, height: 15, color: '#aebdc0', people: 0 },
  { id: 'water-treatment', category: 'water', name: '정수장', detail: '상수도 · 여과와 정수', width: 12, depth: 10, height: 5, color: '#a9c5c6', people: 0 },
  { id: 'reservoir', category: 'water', name: '배수지', detail: '상수도 · 물 저장 탱크', width: 10, depth: 10, height: 5, color: '#b9d4d2', people: 0 },
  { id: 'pump-station', category: 'water', name: '가압장', detail: '상수도 · 수압 유지', width: 7, depth: 6, height: 4, color: '#a7c9c4', people: 0 },
  { id: 'wastewater', category: 'water', name: '하수처리장', detail: '하수도 · 침전과 처리', width: 12, depth: 10, height: 4, color: '#9eb8ad', people: 0 },
  { id: 'intake-station', category: 'water', name: '취수장', detail: '상수도 · 취수관과 스크린', width: 10, depth: 8, height: 5, color: '#aec9c4', people: 0 },
  { id: 'water-tower', category: 'water', name: '급수탑', detail: '상수도 · 고가 물탱크', width: 8, depth: 8, height: 12, color: '#c6d9d5', people: 0 },
  { id: 'park', category: 'nature', name: '소공원', detail: '녹지 · 산책로와 수목', width: 10, depth: 10, height: 1, color: '#8daa72', people: 0 },
  { id: 'playground', category: 'nature', name: '어린이 놀이터', detail: '놀이 · 미끄럼틀과 그네', width: 10, depth: 8, height: 3, color: '#a4bd82', people: 0 },
  { id: 'tree', category: 'nature', name: '활엽수', detail: '조경 · 단일 수목', width: 3, depth: 3, height: 5, color: '#699b68', people: 0 },
  { id: 'pine', category: 'nature', name: '침엽수', detail: '조경 · 단일 수목', width: 3, depth: 3, height: 7, color: '#4f826b', people: 0 },
];

export const assetById = Object.fromEntries(ASSETS.map(asset => [asset.id, asset]));

export const BRUSHES = [
  { id: 'paint', name: '지형 색칠', detail: '선택한 색으로 지형을 칠합니다', icon: 'paint' },
  { id: 'raise', name: '지형 높이기', detail: '지형을 부드럽게 높입니다', icon: 'raise' },
  { id: 'lower', name: '지형 낮추기', detail: '지형을 낮춰 수로를 만듭니다', icon: 'lower' },
  { id: 'flatten', name: '평탄하게', detail: '첫 지점의 높이로 맞춥니다', icon: 'flatten' },
  { id: 'smooth', name: '경사 다듬기', detail: '급격한 경사를 완화합니다', icon: 'terrain' },
];

export const ROAD_TYPES = [
  { id: 'street', name: '왕복 2차로 도로', detail: '주거 지역을 잇는 생활도로', width: 4 },
  { id: 'avenue', name: '왕복 4차로 도로', detail: '도시를 잇는 주요 도로', width: 7 },
  { id: 'path', name: '산책로', detail: '공원과 녹지를 잇는 보행로', width: 2 },
];

export const PLOT_TYPES = [
  { id: 'small', name: '소형 부지', detail: '단독주택 · 작은 상점', width: 12, depth: 12 },
  { id: 'medium', name: '중형 부지', detail: '아파트 · 공원 · 공공시설', width: 24, depth: 24 },
  { id: 'large', name: '대형 부지', detail: '여러 시설을 함께 배치', width: 36, depth: 24 },
];
