// src/components/HelpModal.jsx
import ModalShell from "./ModalShell.jsx";

function Section({ title, children }) {
  return (
    <section style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 900, fontSize: 12.5, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "var(--text)", fontSize: 12, lineHeight: 1.55 }}>{children}</div>
    </section>
  );
}

function Li({ children }) {
  return <li style={{ marginBottom: 6 }}>{children}</li>;
}

export default function HelpModal({ open, onClose, t = (s) => s }) {
  return (
    <ModalShell
      open={open}
      title={t("help.title")}
      subtitle={t("help.subtitle")}
      width={920}
      zIndex={200}
      onClose={onClose}
    >
      <div style={{ maxHeight: "72vh", overflow: "auto", paddingRight: 8 }}>
        <Section title="Scenes">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <Li>왼쪽 <b>Scenes</b> 탭에서 씬을 생성/선택합니다.</Li>
            <Li><b>Create</b>: 씬 이름은 필수이며, 한글은 사용할 수 없습니다.</Li>
            <Li><b>Save</b>: 현재 씬을 JSON으로 다운로드합니다.</Li>
            <Li><b>Import</b>: 상단 Import 버튼으로 JSON 씬을 불러옵니다.</Li>
          </ul>
        </Section>

        <Section title="Meshes (도형 추가 / 배치)">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <Li>왼쪽 <b>Meshes</b> 탭의 도형 아이콘을 누르면 “배치 모드”가 켜집니다.</Li>
            <Li>배치 모드에서 뷰포트(캔버스)를 클릭하면 해당 위치에 도형이 생성됩니다.</Li>
            <Li>배치 모드에서는 마우스 위치에 <b>고스트 프리뷰(반투명 미리보기)</b>가 표시됩니다.</Li>
            <Li>같은 도형 아이콘을 다시 누르면 배치 모드를 해제합니다.</Li>
          </ul>
        </Section>

        <Section title="Materials">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <Li>오른쪽 Inspector에서 <b>Material</b> 타입을 선택할 수 있습니다 (<b>Standard</b> / <b>PBR</b>).</Li>
            <Li><b>PBR</b>에서는 Metallic/Roughness 값을 조절할 수 있습니다.</Li>
            <Li><b>Alpha</b>로 투명도를 조절할 수 있습니다.</Li>
          </ul>
        </Section>

        <Section title="Language">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <Li>우측 상단의 <b>KO/EN</b> 버튼으로 한/영 UI 텍스트를 토글합니다.</Li>
          </ul>
        </Section>

        <Section title="Edit vs Runtime">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <Li>상단 ▶ 버튼으로 <b>Runtime</b> 모드를 토글합니다.</Li>
            <Li>씬이 없으면 Runtime은 비활성화됩니다.</Li>
            <Li>Runtime 모드에서는 편집(기즈모/스크립트 편집 등)이 제한됩니다.</Li>
          </ul>
        </Section>

        <Section title="Scripts">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <Li>오른쪽 Inspector의 <b>스크립트</b> 버튼으로 메쉬 스크립트를 편집합니다.</Li>
            <Li>이벤트 핸들러(예: <code>onClick</code>)와 커스텀 함수(Functions)를 함께 관리할 수 있습니다.</Li>
            <Li>커스텀 함수는 같은 메쉬의 다른 이벤트 핸들러에서 재사용할 수 있습니다.</Li>
          </ul>
        </Section>

        <Section title="Mesh Context Menu (우클릭)">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <Li>메쉬 트리에서 메쉬를 우클릭하면 <b>Frame / Delete / Rename / Properties</b> 메뉴가 표시됩니다.</Li>
            <Li><b>Frame</b>: 카메라가 해당 메쉬로 이동/줌합니다.</Li>
            <Li><b>Properties</b>: 메쉬 요약 정보를 모달로 확인합니다.</Li>
            <Li>다중 선택(CTRL/CMD 클릭) 후 <b>Group</b>으로 하나의 그룹으로 묶을 수 있습니다.</Li>
            <Li>그룹을 선택한 뒤 위치/회전/스케일을 변경하면 자식 메쉬들이 함께 변환됩니다.</Li>
            <Li><b>Ungroup</b>: 그룹을 해제합니다.</Li>
          </ul>
        </Section>

        <Section title="Mesh Tree Drag & Drop">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <Li>메쉬를 드래그해서 특정 <b>그룹</b> 항목에 드롭하면 해당 그룹의 자식으로 이동합니다.</Li>
          </ul>
        </Section>

        <div className="modal-actions" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" type="button" onClick={() => onClose && onClose()}>
            {t("help.close")}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
