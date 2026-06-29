import type { Dispatch, SetStateAction } from 'react'

export type LocationType = 'WAREHOUSE' | 'RACK' | 'ZONE'

export type LocationFormState = {
  locationCode: string
  locationName: string
  parentId: string
  locationType: LocationType
  useYn: 'Y' | 'N'
}

type ParentOption = { id: number; locationCode: string; locationName: string }

type Props = {
  open: boolean
  editingId: number | null
  saving: boolean
  form: LocationFormState
  setForm: Dispatch<SetStateAction<LocationFormState>>
  parentOptions: ParentOption[]
  onSave: () => void
  onClose: () => void
}

export function typeLabel(t: LocationType): string {
  if (t === 'WAREHOUSE') return '창고'
  if (t === 'RACK') return '랙'
  return '구역'
}

export function typeBadgeClass(t: string): string {
  if (t === 'WAREHOUSE') return 'mesLocTypeBadge mesLocTypeBadge--warehouse'
  if (t === 'RACK') return 'mesLocTypeBadge mesLocTypeBadge--rack'
  if (t === 'ZONE') return 'mesLocTypeBadge mesLocTypeBadge--zone'
  return 'mesLocTypeBadge'
}

function useBadgeClass(y: 'Y' | 'N') {
  return y === 'Y' ? 'mesLocUseBadge mesLocUseBadge--y' : 'mesLocUseBadge mesLocUseBadge--n'
}

function IconWarehouse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 9l9-5 9 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" />
      <path d="M9 22V12h6v10" />
    </svg>
  )
}

function IconSave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function LocationFormModal({
  open,
  editingId,
  saving,
  form,
  setForm,
  parentOptions,
  onSave,
  onClose,
}: Props) {
  if (!open) return null

  const parentLabel = parentOptions.find((p) => String(p.id) === form.parentId)

  return (
    <div className="mesLocModalRoot" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div className="mesLocModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-loc-modal-title">
        <header className="mesLocModalHead">
          <div className="mesLocModalHeadTitle">
            <span className="mesLocModalHeadIcon"><IconWarehouse /></span>
            <div>
              <h2 className="mesLocModalTitle" id="mes-loc-modal-title">
                {editingId == null ? '창고·위치 등록' : '창고·위치 수정'}
              </h2>
              <p className="mesLocModalSub">
                {editingId == null ? '창고·랙·구역 위치를 등록합니다.' : `ID ${editingId}`}
              </p>
            </div>
          </div>
          <div className="mesLocModalHeadBadges">
            <span className={typeBadgeClass(form.locationType)}>{typeLabel(form.locationType)}</span>
            <span className={useBadgeClass(form.useYn)}>{form.useYn === 'Y' ? '사용' : '미사용'}</span>
          </div>
        </header>

        <div className="mesLocModalBody">
          <div className="mesLocModalFieldGrid">
            <label className="mesLocModalField">
              <span className="mesLocModalFieldLabel">위치 코드</span>
              <input
                className="mesLocModalInput mono"
                value={form.locationCode}
                onChange={(e) => setForm((f) => ({ ...f, locationCode: e.target.value }))}
              />
            </label>
            <label className="mesLocModalField">
              <span className="mesLocModalFieldLabel">명칭</span>
              <input
                className="mesLocModalInput"
                value={form.locationName}
                onChange={(e) => setForm((f) => ({ ...f, locationName: e.target.value }))}
              />
            </label>
            <label className="mesLocModalField">
              <span className="mesLocModalFieldLabel">유형</span>
              <select
                className="mesLocModalInput"
                value={form.locationType}
                onChange={(e) => setForm((f) => ({ ...f, locationType: e.target.value as LocationType }))}
              >
                <option value="WAREHOUSE">창고</option>
                <option value="RACK">랙</option>
                <option value="ZONE">구역</option>
              </select>
            </label>
            <label className="mesLocModalField">
              <span className="mesLocModalFieldLabel">사용</span>
              <select
                className="mesLocModalInput"
                value={form.useYn}
                onChange={(e) => setForm((f) => ({ ...f, useYn: e.target.value as 'Y' | 'N' }))}
              >
                <option value="Y">Y</option>
                <option value="N">N</option>
              </select>
            </label>
            <label className="mesLocModalField mesLocModalField--full">
              <span className="mesLocModalFieldLabel">상위 위치</span>
              <select
                className="mesLocModalInput"
                value={form.parentId}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              >
                <option value="">없음</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.locationCode} · {p.locationName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {parentLabel ? (
            <p className="mesLocModalHint">상위: {parentLabel.locationCode} · {parentLabel.locationName}</p>
          ) : null}
        </div>

        <footer className="mesLocModalFoot">
          <button type="button" className="mesLocModalBtn mesLocModalBtn--cancel" disabled={saving} onClick={onClose}>
            <IconX />
            취소
          </button>
          <button type="button" className="mesLocModalBtn mesLocModalBtn--save" disabled={saving} onClick={onSave}>
            <IconSave />
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  )
}
