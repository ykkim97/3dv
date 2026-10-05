import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../editor/components/CityIcon.jsx';
import { ASSETS, BRUSHES, CATEGORIES, PLOT_TYPES, PRESETS, ROAD_TYPES } from '../presets/catalog.js';
import { BRIDGE_PRESETS } from '../presets/bridgePresets.js';
import { FLOW_EFFECTS } from '../connections/connectionModel.js';
import { ASSET_USAGE, MANUAL_SECTIONS, SHORTCUTS, TUTORIALS } from './manualContent.js';
import './manual.css';

const chapters = [
  ...MANUAL_SECTIONS.map(({ id, title }) => ({ id, title })),
  { id: 'presets', title: '프리셋 사전' }, { id: 'shortcuts', title: '단축키' },
  { id: 'tutorials', title: '따라 해 보기' }, { id: 'api', title: 'JavaScript API · 예정' },
];
const categoryUsage = {
  residential: '주거 구역을 구성합니다. 부지 안에 배치하고 도로 접근과 전력·수도 공급을 확인하세요. 표시 인원은 주거 수용 인원입니다.',
  commercial: '상점·업무용 빌딩·공장을 배치해 상업과 산업 구역을 구성합니다. 주거지와 도로로 이어 배치하고 공급 상태를 확인하세요.',
  landmark: '도시의 공공시설로 사용합니다. 주거 구역 주변에 배치하고 도로·공급 상태를 확인하세요.',
  nature: '공원과 녹지를 꾸밉니다. 부지의 여유 공간에 배치해 도시 경관을 구성하세요.',
};

export default function ManualPage({ onClose }) {
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState('start');
  const page = useRef(null);
  const search = query.trim().toLocaleLowerCase();
  const matches = (...values) => !search || values.join(' ').toLocaleLowerCase().includes(search);
  const sections = MANUAL_SECTIONS.map(section => ({ ...section, blocks: section.blocks.filter(block => matches(section.title, ...block)) })).filter(section => section.blocks.length);
  const assets = useMemo(() => ASSETS.map(asset => ({ ...asset, usage: ASSET_USAGE[asset.id] || categoryUsage[asset.category] || asset.detail })), []);
  const groups = CATEGORIES.map(category => ({ ...category, assets: assets.filter(asset => asset.category === category.id && matches(category.name, asset.name, asset.id, asset.detail, asset.usage)) })).filter(category => category.assets.length);
  const worlds = PRESETS.filter(preset => matches('도시 지도 프리셋', preset.name, preset.subtitle, preset.id));
  const plots = PLOT_TYPES.filter(preset => matches('부지 프리셋', preset.name, preset.detail));
  const roads = ROAD_TYPES.filter(preset => matches('도로 프리셋', preset.name, preset.detail));
  const bridges = BRIDGE_PRESETS.filter(preset => matches('교량 프리셋', preset.name, preset.detail));
  const brushes = BRUSHES.filter(preset => matches('지형 브러시', preset.name, preset.detail));
  const effects = FLOW_EFFECTS.filter(effect => matches('흐름 효과', effect.name, effect.id));
  const shortcuts = SHORTCUTS.filter(row => matches('단축키', ...row));
  const tutorials = TUTORIALS.filter(tutorial => matches('튜토리얼 따라 해 보기', tutorial.title, tutorial.goal, ...tutorial.steps));
  const showApi = matches('JavaScript API 편의 함수 비개발자 준비 중 예정 자동화 실행 취소 예제');
  const hasPresets = groups.length + worlds.length + plots.length + roads.length + bridges.length + brushes.length + effects.length > 0;
  const hasResults = sections.length || hasPresets || shortcuts.length || tutorials.length || showApi;
  const visibleChapters = new Set([...sections.map(section => section.id), ...(hasPresets ? ['presets'] : []), ...(shortcuts.length ? ['shortcuts'] : []), ...(tutorials.length ? ['tutorials'] : []), ...(showApi ? ['api'] : [])]);
  const goToChapter = id => {
    page.current?.querySelector(`#manual-${id}`)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    setActiveChapter(id);
  };
  useEffect(() => {
    const root = page.current;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) setActiveChapter(visible[0].target.id.replace('manual-', ''));
    }, { root, rootMargin: '-96px 0px -55% 0px', threshold: 0 });
    root.querySelectorAll('.manual-section').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [search]);
  return <div className="city-manual" ref={page}>
    <header className="manual-header"><div className="manual-identity"><span className="manual-logo" aria-hidden="true"><Icon name="building" size={24} /></span><div><span className="manual-brand">LUMATRIX / CITY STUDIO</span><strong>사용 매뉴얼</strong></div><span className="manual-header-badge">GUIDE</span></div><div className="manual-header-actions"><button onClick={() => window.print()}><Icon name="download" size={16} /> 인쇄 · PDF</button><button className="manual-return" autoFocus onClick={onClose}>편집기로 돌아가기 <span aria-hidden="true">↗</span></button></div></header>
    <div className="manual-layout">
      <aside className="manual-sidebar"><label htmlFor="manual-search">필요한 내용을 찾아보세요</label><div className="manual-search"><Icon name="search" size={16} /><input id="manual-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="프리셋, 단축키, 사용 방법…" />{query && <button aria-label="검색 초기화" onClick={() => setQuery('')}>×</button>}</div><span className="manual-nav-label">목차 <span>CONTENTS</span></span><nav aria-label="매뉴얼 목차">{chapters.map((chapter, index) => <a key={chapter.id} href={`#manual-${chapter.id}`} aria-current={activeChapter === chapter.id && visibleChapters.has(chapter.id) ? 'location' : undefined} aria-disabled={!visibleChapters.has(chapter.id)} tabIndex={visibleChapters.has(chapter.id) ? undefined : -1} onClick={event => { event.preventDefault(); if (visibleChapters.has(chapter.id)) goToChapter(chapter.id); }}><span>{String(index + 1).padStart(2, '0')}</span>{chapter.title}</a>)}</nav><div className="manual-sidebar-note"><Icon name="info" size={18} /><p>현재 제공되는 기능을 안내합니다. 준비 중인 기능은 별도로 표시되어 있습니다.</p></div></aside>
      <main className="manual-content" id="manual-content">
        <div className="manual-hero"><div className="manual-hero-copy"><span className="manual-kicker"><i /> CITY STUDIO HANDBOOK</span><h1>아이디어를 도시로<br />만드는 방법.</h1><p>부지를 만들고, 시설을 연결하고, 도시를 완성하세요.<br />처음 시작하는 순간부터 발표 장면을 만드는 순간까지.</p><button className="manual-primary" onClick={() => { if (search) setQuery(''); requestAnimationFrame(() => goToChapter('tutorials')); }}>튜토리얼 시작하기 <span aria-hidden="true">→</span></button></div><div className="manual-hero-art" aria-hidden="true"><div className="manual-art-grid" /><div className="manual-art-orbit" /><span className="manual-art-building one"><Icon name="building" size={76} /></span><span className="manual-art-building two"><Icon name="home" size={50} /></span><span className="manual-art-building three"><Icon name="power" size={34} /></span><span className="manual-art-caption">DESIGN · CONNECT · CREATE</span></div><div className="manual-hero-stats"><span><strong>{ASSETS.length}</strong> 시설·소품</span><span><strong>{BRIDGE_PRESETS.length}</strong> 교량 프리셋</span><span><strong>{FLOW_EFFECTS.length}</strong> 흐름 효과</span><span><i /> 오프라인에서도 사용 가능</span></div></div>
        {search && <p className="manual-search-summary" role="status">{hasResults ? `“${query}”에 해당하는 내용을 표시합니다.` : `“${query}” 검색 결과가 없습니다. 다른 단어로 검색해 보세요.`}</p>}
        {sections.map(section => <section className="manual-section" id={`manual-${section.id}`} key={section.id}><h2>{section.title}</h2><p className="manual-intro">{section.intro}</p><div className="manual-blocks">{section.blocks.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>{section.id === 'connections' && <div className="manual-flow" aria-label="개념적 전력 흐름"><span>발전소</span><b>→</b><span>변전소</span><b>→</b><span>배전 설비</span><b>→</b><span>공장 · 주거</span></div>}</section>)}
        {hasPresets && <section className="manual-section" id="manual-presets"><h2>프리셋 사전</h2><p className="manual-intro">프로그램의 실제 카탈로그와 연동됩니다. 크기는 기본 외형의 너비 × 깊이 × 높이입니다.</p>
          {!!worlds.length && <><h3>도시 · 지도</h3><div className="manual-cards">{worlds.map(preset => <article key={preset.id}><span className="manual-swatch" style={{ backgroundColor: preset.color }} /><h4>{preset.name}</h4><p>{preset.subtitle}</p><small>{preset.id} · 소형 / 중형 지도</small></article>)}</div></>}
          {groups.map(category => <div className="manual-preset-group" key={category.id}><h3>{category.name} <span>{category.assets.length}</span></h3><div className="manual-cards">{category.assets.map(asset => <article key={asset.id}><span className="manual-swatch" style={{ backgroundColor: asset.color }} /><h4>{asset.name}</h4><div className="manual-asset-detail">{asset.detail}</div><p>{asset.usage}</p><small><code>{asset.id}</code> · {asset.width} × {asset.depth} × {asset.height} m{asset.people > 0 ? ` · 수용 ${asset.people}명` : ''}</small></article>)}</div></div>)}
          {[['부지', plots, preset => `${preset.width} × ${preset.depth} m · 배치 시 크기 조절 가능`], ['도로', roads, preset => `폭 ${preset.width} m`], ['교량', bridges, preset => `지원 길이 ${preset.min}–${preset.max} m`], ['지형 브러시', brushes, () => '왼쪽 드래그로 편집']].filter(([, items]) => items.length).map(([title, items, detail]) => <div className="manual-preset-group" key={title}><h3>{title}</h3><div className="manual-cards">{items.map(preset => <article key={preset.id}><h4>{preset.name}</h4><p>{preset.detail}</p><small>{detail(preset)}</small></article>)}</div></div>)}
          {!!effects.length && <><h3>흐름 효과</h3><div className="manual-chips">{effects.map(effect => <span key={effect.id}>{effect.name}</span>)}</div><p>흐르는 띠는 구간을 따라 흘러가는 띠, 방향 화살표는 흐르는 화살표, 빛 펄스는 밝은 빛의 이동, 흐르는 점은 연속된 점, 파동 효과는 밝기가 물결처럼 변하는 효과입니다.</p></>}
        </section>}
        {!!shortcuts.length && <section className="manual-section" id="manual-shortcuts"><h2>단축키</h2><p className="manual-intro">텍스트·숫자 입력 중에는 편집기 단축키가 동작하지 않습니다. macOS에서는 Ctrl 대신 ⌘를 사용합니다.</p><div className="manual-table-wrap"><table><thead><tr><th>키 · 마우스</th><th>동작</th></tr></thead><tbody>{shortcuts.map(([key, action]) => <tr key={key}><td><kbd>{key}</kbd></td><td>{action}</td></tr>)}</tbody></table></div></section>}
        {!!tutorials.length && <section className="manual-section" id="manual-tutorials"><h2>따라 해 보기</h2><p className="manual-intro">새 도시를 만들기 전에 기존 작업을 파일로 보관하세요.</p>{tutorials.map(tutorial => <article className="manual-tutorial" key={tutorial.title}><h3>{tutorial.title}</h3><p>{tutorial.goal}</p><ol>{tutorial.steps.map(step => <li key={step}>{step}</li>)}</ol></article>)}</section>}
        {showApi && <section className="manual-section" id="manual-api"><span className="manual-planned">준비 중 · 현재 사용 불가</span><h2>JavaScript 편의 API</h2><p>비개발자도 짧은 JavaScript로 시설 배치, 속성 수정, 흐름선 연결과 반복 작업을 할 수 있는 API를 제공할 예정입니다. 현재 도시 편집기에 공개된 편의 함수나 실행 화면은 없습니다.</p><div className="manual-blocks"><article><h3>제공을 검토하는 작업</h3><p>이름·설비 번호로 시설 찾기, 여러 시설 일괄 배치, 속성 변경, 연결 생성, 장면 저장과 시점 이동.</p></article><article><h3>추후 문서 구성</h3><p>각 함수의 쉬운 설명, 입력값·단위, 반환값, 오류 메시지, 복사해서 실행하는 예제와 실행 취소 방법을 제공하겠습니다. 함수 이름과 문법은 구현 시 확정합니다.</p></article></div></section>}
        <footer className="manual-footer">LUMATRIX CITY STUDIO · 사용 매뉴얼<button onClick={onClose}>편집기로 돌아가기</button></footer>
      </main>
    </div>
  </div>;
}
