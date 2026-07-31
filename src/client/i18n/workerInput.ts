export type WiLocale = 'ko' | 'en' | 'zh' | 'vi' | 'th' | 'si'

export const WI_LOCALES: WiLocale[] = ['ko', 'en', 'zh', 'vi', 'th', 'si']

export const WI_LOCALE_LABELS: Record<WiLocale, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  si: 'සිංහල',
}

const STORAGE_KEY = 'mes-wi-locale'

export function getStoredWiLocale(): WiLocale {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && WI_LOCALES.includes(v as WiLocale)) return v as WiLocale
  } catch {
    /* ignore */
  }
  return 'ko'
}

export function setStoredWiLocale(locale: WiLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

export type WiMessages = {
  stepLot: string
  stepResult: string
  stepDefect: string
  stepConfirm: string
  noAssignment: string
  lineUnassigned: string
  workerHash: string
  processHash: string
  productHash: string
  defectTypeHash: string
  decrease: string
  increase: string
  pageTitle: string
  logout: string
  language: string
  savedTitle: string
  savedDesc: string
  savedDefectNote: string
  nextEntry: string
  loading: string
  selectLotTitle: string
  searchPlaceholder: string
  noActiveLots: string
  inProgress: string
  progressAria: string
  resultReflect: string
  assignSummary: string
  line: string
  worker: string
  lot: string
  product: string
  remainingQty: string
  qtyInputTitle: string
  holdBanner: string
  holdReason: string
  targetProcess: string
  fillRemaining: string
  input: string
  good: string
  defect: string
  defectDetailTitle: string
  defectTotal: string
  defectShort: string
  defectOver: string
  noDefectTypes: string
  defectTypeAria: string
  defectQtyAria: string
  removeRow: string
  addDefectType: string
  confirmTitle: string
  sumCheck: string
  ok: string
  error: string
  saveNote: string
  back: string
  next: string
  saving: string
  save: string
  errSelectLot: string
  errHold: string
  errNoWorkerAssign: string
  errNoProcess: string
  errInputQty: string
  errQtyOver: string
  errQtyZero: string
  errNoDefectTypeReg: string
  errSelectDefectType: string
  errDefectSum: string
}

const ko: WiMessages = {
  stepLot: 'LOT 선택',
  stepResult: '실적 입력',
  stepDefect: '불량 상세',
  stepConfirm: '확인',
  noAssignment: '배정 없음',
  lineUnassigned: '라인 미지정',
  workerHash: '작업자#{{id}}',
  processHash: '공정#{{id}}',
  productHash: '품목 #{{id}}',
  defectTypeHash: '유형 #{{id}}',
  decrease: '감소',
  increase: '증가',
  pageTitle: '현장 실적 입력',
  logout: '로그아웃',
  language: '언어',
  savedTitle: '실적이 저장되었습니다',
  savedDesc: '투입 {{input}} · 양품 {{good}} · 불량 {{defect}}',
  savedDefectNote: ' (불량 이력 반영)',
  nextEntry: '다음 실적 등록',
  loading: '데이터 불러오는 중…',
  selectLotTitle: '생산 LOT 선택',
  searchPlaceholder: 'LOT / 품목 / 라인 / 작업자 검색',
  noActiveLots: '진행 중인 LOT가 없습니다.',
  inProgress: '진행',
  progressAria: '진행 {{done}}/{{total}}, {{pct}}%',
  resultReflect: '실적 반영',
  assignSummary: '배정 {{workers}}명 · 공정 {{processes}}건 ({{names}})',
  line: '라인',
  worker: '작업자',
  lot: 'LOT',
  product: '품목',
  remainingQty: '잔여 수량',
  qtyInputTitle: '실적 수량 입력',
  holdBanner: '이 LOT의 작업지시가 보류(HOLD) 상태입니다.',
  holdReason: ' 사유: {{reason}}',
  targetProcess: '실적이 기록될 공정',
  fillRemaining: '잔여 수량 한 번에 입력 ({{qty}})',
  input: '투입',
  good: '양품',
  defect: '불량',
  defectDetailTitle: '불량 유형별 수량',
  defectTotal: '불량 {{defect}}개 · 합계 {{sum}}',
  defectShort: '{{n}}개 부족',
  defectOver: '{{n}}개 초과',
  noDefectTypes: '이 품목에 등록된 불량유형이 없습니다.',
  defectTypeAria: '불량 유형',
  defectQtyAria: '불량 수량',
  removeRow: '행 삭제',
  addDefectType: '+ 유형 추가',
  confirmTitle: '입력 내용 확인',
  sumCheck: '합계 검증',
  ok: 'OK',
  error: '오류',
  saveNote: '저장 시 LOT 실적·불량 이력·재고에 반영됩니다.',
  back: '이전',
  next: '다음',
  saving: '저장 중…',
  save: '실적 저장',
  errSelectLot: '생산 LOT를 선택하세요.',
  errHold: '보류 중인 작업지시입니다. 보류 해제 후 입력하세요.',
  errNoWorkerAssign: '작업지시에 공정별 작업자 배정이 없습니다. 관리자에게 배정을 요청하세요.',
  errNoProcess: '이 품목에 등록된 공정이 없습니다. 관리자에게 MBOM 공정 등록을 요청하세요.',
  errInputQty: '투입 수량을 입력하세요.',
  errQtyOver: '양품 + 불량은 투입 수량 이하여야 합니다.',
  errQtyZero: '양품 또는 불량 수량을 입력하세요.',
  errNoDefectTypeReg: '등록된 불량유형이 없습니다. 관리자에게 불량유형 등록을 요청하세요.',
  errSelectDefectType: '불량 유형을 선택하세요.',
  errDefectSum: '유형별 합계({{sum}})가 불량 수량({{defect}})과 일치해야 합니다.',
}

const en: WiMessages = {
  stepLot: 'Select LOT',
  stepResult: 'Enter results',
  stepDefect: 'Defect details',
  stepConfirm: 'Confirm',
  noAssignment: 'Not assigned',
  lineUnassigned: 'Line not set',
  workerHash: 'Worker #{{id}}',
  processHash: 'Process #{{id}}',
  productHash: 'Product #{{id}}',
  defectTypeHash: 'Type #{{id}}',
  decrease: 'Decrease',
  increase: 'Increase',
  pageTitle: 'Shop-floor entry',
  logout: 'Log out',
  language: 'Language',
  savedTitle: 'Results saved',
  savedDesc: 'Input {{input}} · Good {{good}} · Defect {{defect}}',
  savedDefectNote: ' (defect history recorded)',
  nextEntry: 'Next entry',
  loading: 'Loading…',
  selectLotTitle: 'Select production LOT',
  searchPlaceholder: 'Search LOT / product / line / worker',
  noActiveLots: 'No LOTs in progress.',
  inProgress: 'Active',
  progressAria: 'Progress {{done}}/{{total}}, {{pct}}%',
  resultReflect: 'Applied to',
  assignSummary: '{{workers}} workers · {{processes}} processes ({{names}})',
  line: 'Line',
  worker: 'Worker',
  lot: 'LOT',
  product: 'Product',
  remainingQty: 'Remaining qty',
  qtyInputTitle: 'Enter quantities',
  holdBanner: 'This work order is on HOLD.',
  holdReason: ' Reason: {{reason}}',
  targetProcess: 'Target process',
  fillRemaining: 'Fill remaining qty ({{qty}})',
  input: 'Input',
  good: 'Good',
  defect: 'Defect',
  defectDetailTitle: 'Defect by type',
  defectTotal: 'Defect {{defect}} · Sum {{sum}}',
  defectShort: '{{n}} short',
  defectOver: '{{n}} over',
  noDefectTypes: 'No defect types for this product.',
  defectTypeAria: 'Defect type',
  defectQtyAria: 'Defect quantity',
  removeRow: 'Remove row',
  addDefectType: '+ Add type',
  confirmTitle: 'Review entry',
  sumCheck: 'Total check',
  ok: 'OK',
  error: 'Error',
  saveNote: 'Saving updates LOT results, defect history, and inventory.',
  back: 'Back',
  next: 'Next',
  saving: 'Saving…',
  save: 'Save results',
  errSelectLot: 'Select a production LOT.',
  errHold: 'Work order is on hold. Resume before entry.',
  errNoWorkerAssign: 'No workers assigned by process. Contact supervisor.',
  errNoProcess: 'No processes for this product. Contact supervisor.',
  errInputQty: 'Enter input quantity.',
  errQtyOver: 'Good + defect must not exceed input.',
  errQtyZero: 'Enter good or defect quantity.',
  errNoDefectTypeReg: 'No defect types registered. Contact supervisor.',
  errSelectDefectType: 'Select a defect type.',
  errDefectSum: 'Type totals ({{sum}}) must match defect qty ({{defect}}).',
}

const zh: WiMessages = {
  stepLot: '选择 LOT',
  stepResult: '录入实绩',
  stepDefect: '不良明细',
  stepConfirm: '确认',
  noAssignment: '未分配',
  lineUnassigned: '未指定产线',
  workerHash: '作业员#{{id}}',
  processHash: '工序#{{id}}',
  productHash: '品目 #{{id}}',
  defectTypeHash: '类型 #{{id}}',
  decrease: '减少',
  increase: '增加',
  pageTitle: '现场实绩录入',
  logout: '退出登录',
  language: '语言',
  savedTitle: '实绩已保存',
  savedDesc: '投入 {{input}} · 良品 {{good}} · 不良 {{defect}}',
  savedDefectNote: '（已记录不良履历）',
  nextEntry: '继续录入',
  loading: '加载中…',
  selectLotTitle: '选择生产 LOT',
  searchPlaceholder: '搜索 LOT / 品目 / 产线 / 作业员',
  noActiveLots: '没有进行中的 LOT。',
  inProgress: '进行中',
  progressAria: '进度 {{done}}/{{total}}，{{pct}}%',
  resultReflect: '实绩反映',
  assignSummary: '分配 {{workers}} 人 · {{processes}} 道工序 ({{names}})',
  line: '产线',
  worker: '作业员',
  lot: 'LOT',
  product: '品目',
  remainingQty: '剩余数量',
  qtyInputTitle: '录入数量',
  holdBanner: '此 LOT 的作业指示处于保留(HOLD)状态。',
  holdReason: ' 原因：{{reason}}',
  targetProcess: '记录实绩的工序',
  fillRemaining: '一次性填入剩余数量 ({{qty}})',
  input: '投入',
  good: '良品',
  defect: '不良',
  defectDetailTitle: '按不良类型录入',
  defectTotal: '不良 {{defect}} · 合计 {{sum}}',
  defectShort: '少 {{n}}',
  defectOver: '多 {{n}}',
  noDefectTypes: '此品目未登记不良类型。',
  defectTypeAria: '不良类型',
  defectQtyAria: '不良数量',
  removeRow: '删除行',
  addDefectType: '+ 添加类型',
  confirmTitle: '确认录入内容',
  sumCheck: '合计校验',
  ok: 'OK',
  error: '错误',
  saveNote: '保存后将反映 LOT 实绩、不良履历及库存。',
  back: '上一步',
  next: '下一步',
  saving: '保存中…',
  save: '保存实绩',
  errSelectLot: '请选择生产 LOT。',
  errHold: '作业指示已保留，请解除后再录入。',
  errNoWorkerAssign: '未按工序分配作业员，请联系管理员。',
  errNoProcess: '此品目无工序，请联系管理员登记 MBOM。',
  errInputQty: '请输入投入数量。',
  errQtyOver: '良品 + 不良不得超过投入数量。',
  errQtyZero: '请输入良品或不良数量。',
  errNoDefectTypeReg: '未登记不良类型，请联系管理员。',
  errSelectDefectType: '请选择不良类型。',
  errDefectSum: '各类型合计 ({{sum}}) 须与不良数量 ({{defect}}) 一致。',
}

const vi: WiMessages = {
  stepLot: 'Chọn LOT',
  stepResult: 'Nhập kết quả',
  stepDefect: 'Chi tiết lỗi',
  stepConfirm: 'Xác nhận',
  noAssignment: 'Chưa phân công',
  lineUnassigned: 'Chưa chỉ định chuyền',
  workerHash: 'Công nhân #{{id}}',
  processHash: 'Công đoạn #{{id}}',
  productHash: 'Sản phẩm #{{id}}',
  defectTypeHash: 'Loại #{{id}}',
  decrease: 'Giảm',
  increase: 'Tăng',
  pageTitle: 'Nhập hiện trường',
  logout: 'Đăng xuất',
  language: 'Ngôn ngữ',
  savedTitle: 'Đã lưu kết quả',
  savedDesc: 'Đầu vào {{input}} · Đạt {{good}} · Lỗi {{defect}}',
  savedDefectNote: ' (đã ghi lịch sử lỗi)',
  nextEntry: 'Nhập tiếp',
  loading: 'Đang tải…',
  selectLotTitle: 'Chọn LOT sản xuất',
  searchPlaceholder: 'Tìm LOT / sản phẩm / chuyền / công nhân',
  noActiveLots: 'Không có LOT đang chạy.',
  inProgress: 'Đang chạy',
  progressAria: 'Tiến độ {{done}}/{{total}}, {{pct}}%',
  resultReflect: 'Phản ánh',
  assignSummary: '{{workers}} người · {{processes}} công đoạn ({{names}})',
  line: 'Chuyền',
  worker: 'Công nhân',
  lot: 'LOT',
  product: 'Sản phẩm',
  remainingQty: 'Số lượng còn',
  qtyInputTitle: 'Nhập số lượng',
  holdBanner: 'Lệnh sản xuất đang HOLD.',
  holdReason: ' Lý do: {{reason}}',
  targetProcess: 'Công đoạn ghi nhận',
  fillRemaining: 'Nhập hết số còn lại ({{qty}})',
  input: 'Đầu vào',
  good: 'Đạt',
  defect: 'Lỗi',
  defectDetailTitle: 'Lỗi theo loại',
  defectTotal: 'Lỗi {{defect}} · Tổng {{sum}}',
  defectShort: 'thiếu {{n}}',
  defectOver: 'thừa {{n}}',
  noDefectTypes: 'Chưa có loại lỗi cho sản phẩm này.',
  defectTypeAria: 'Loại lỗi',
  defectQtyAria: 'Số lượng lỗi',
  removeRow: 'Xóa dòng',
  addDefectType: '+ Thêm loại',
  confirmTitle: 'Xác nhận nhập liệu',
  sumCheck: 'Kiểm tra tổng',
  ok: 'OK',
  error: 'Lỗi',
  saveNote: 'Lưu sẽ cập nhật LOT, lịch sử lỗi và tồn kho.',
  back: 'Trước',
  next: 'Tiếp',
  saving: 'Đang lưu…',
  save: 'Lưu kết quả',
  errSelectLot: 'Chọn LOT sản xuất.',
  errHold: 'Lệnh đang giữ. Mở lại trước khi nhập.',
  errNoWorkerAssign: 'Chưa phân công theo công đoạn. Liên hệ quản lý.',
  errNoProcess: 'Không có công đoạn. Liên hệ quản lý đăng ký MBOM.',
  errInputQty: 'Nhập số lượng đầu vào.',
  errQtyOver: 'Đạt + lỗi không được vượt đầu vào.',
  errQtyZero: 'Nhập số đạt hoặc lỗi.',
  errNoDefectTypeReg: 'Chưa đăng ký loại lỗi. Liên hệ quản lý.',
  errSelectDefectType: 'Chọn loại lỗi.',
  errDefectSum: 'Tổng loại ({{sum}}) phải bằng số lỗi ({{defect}}).',
}

const th: WiMessages = {
  stepLot: 'เลือก LOT',
  stepResult: 'บันทึกผล',
  stepDefect: 'รายละเอียดของเสีย',
  stepConfirm: 'ยืนยัน',
  noAssignment: 'ยังไม่มอบหมาย',
  lineUnassigned: 'ยังไม่ระบุสาย',
  workerHash: 'พนักงาน #{{id}}',
  processHash: 'ขั้นตอน #{{id}}',
  productHash: 'สินค้า #{{id}}',
  defectTypeHash: 'ประเภท #{{id}}',
  decrease: 'ลด',
  increase: 'เพิ่ม',
  pageTitle: 'บันทึกหน้างาน',
  logout: 'ออกจากระบบ',
  language: 'ภาษา',
  savedTitle: 'บันทึกผลแล้ว',
  savedDesc: 'ป้อน {{input}} · ดี {{good}} · เสีย {{defect}}',
  savedDefectNote: ' (บันทึกประวัติของเสีย)',
  nextEntry: 'บันทึกถัดไป',
  loading: 'กำลังโหลด…',
  selectLotTitle: 'เลือก LOT การผลิต',
  searchPlaceholder: 'ค้นหา LOT / สินค้า / สาย / พนักงาน',
  noActiveLots: 'ไม่มี LOT ที่กำลังดำเนินการ',
  inProgress: 'ดำเนินการ',
  progressAria: 'ความคืบหน้า {{done}}/{{total}}, {{pct}}%',
  resultReflect: 'สะท้อนผล',
  assignSummary: '{{workers}} คน · {{processes}} ขั้นตอน ({{names}})',
  line: 'สาย',
  worker: 'พนักงาน',
  lot: 'LOT',
  product: 'สินค้า',
  remainingQty: 'จำนวนคงเหลือ',
  qtyInputTitle: 'ป้อนจำนวน',
  holdBanner: 'คำสั่งงานนี้อยู่ในสถานะ HOLD',
  holdReason: ' เหตุผล: {{reason}}',
  targetProcess: 'ขั้นตอนที่บันทึก',
  fillRemaining: 'ป้อนจำนวนคงเหลือทั้งหมด ({{qty}})',
  input: 'ป้อน',
  good: 'ดี',
  defect: 'เสีย',
  defectDetailTitle: 'ของเสียตามประเภท',
  defectTotal: 'เสีย {{defect}} · รวม {{sum}}',
  defectShort: 'ขาด {{n}}',
  defectOver: 'เกิน {{n}}',
  noDefectTypes: 'ไม่มีประเภทของเสียสำหรับสินค้านี้',
  defectTypeAria: 'ประเภทของเสีย',
  defectQtyAria: 'จำนวนของเสีย',
  removeRow: 'ลบแถว',
  addDefectType: '+ เพิ่มประเภท',
  confirmTitle: 'ตรวจสอบการป้อน',
  sumCheck: 'ตรวจรวม',
  ok: 'OK',
  error: 'ผิดพลาด',
  saveNote: 'บันทึกจะอัปเดต LOT ประวัติของเสีย และสต็อก',
  back: 'ก่อนหน้า',
  next: 'ถัดไป',
  saving: 'กำลังบันทึก…',
  save: 'บันทึกผล',
  errSelectLot: 'เลือก LOT การผลิต',
  errHold: 'คำสั่งงานถูกพัก เปิดก่อนบันทึก',
  errNoWorkerAssign: 'ยังไม่มอบหมายตามขั้นตอน ติดต่อหัวหน้า',
  errNoProcess: 'ไม่มีขั้นตอน ติดต่อลงทะเบียน MBOM',
  errInputQty: 'ป้อนจำนวนป้อน',
  errQtyOver: 'ดี + เสียต้องไม่เกินป้อน',
  errQtyZero: 'ป้อนจำนวนดีหรือเสีย',
  errNoDefectTypeReg: 'ยังไม่ลงทะเบียนประเภทของเสีย ติดต่อหัวหน้า',
  errSelectDefectType: 'เลือกประเภทของเสีย',
  errDefectSum: 'รวมประเภท ({{sum}}) ต้องเท่ากับจำนวนเสีย ({{defect}})',
}

const si: WiMessages = {
  stepLot: 'LOT තෝරන්න',
  stepResult: 'ප්‍රතිඵල ඇතුළත් කරන්න',
  stepDefect: 'දෝෂ විස්තර',
  stepConfirm: 'තහවුරු කරන්න',
  noAssignment: 'පවරා නැත',
  lineUnassigned: 'රේඛාව නියමිත නැත',
  workerHash: 'කම්කරු #{{id}}',
  processHash: 'ක්‍රියාවලිය #{{id}}',
  productHash: 'නිෂ්පාදනය #{{id}}',
  defectTypeHash: 'වර්ගය #{{id}}',
  decrease: 'අඩු කරන්න',
  increase: 'වැඩි කරන්න',
  pageTitle: 'ක්ෂේත්‍ර ඇතුළත් කිරීම',
  logout: 'පිටවන්න',
  language: 'භාෂාව',
  savedTitle: 'ප්‍රතිඵල සුරකින ලදී',
  savedDesc: 'ආදාන {{input}} · හොඳ {{good}} · දෝෂ {{defect}}',
  savedDefectNote: ' (දෝෂ ඉතිහාසය සටහන්)',
  nextEntry: 'ඊළඟ ඇතුළත් කිරීම',
  loading: 'පූරණය වෙමින්…',
  selectLotTitle: 'නිෂ්පාදන LOT තෝරන්න',
  searchPlaceholder: 'LOT / නිෂ්පාදනය / රේඛාව / කම්කරු සොයන්න',
  noActiveLots: 'ක්‍රියාත්මක LOT නැත.',
  inProgress: 'ක්‍රියාත්මක',
  progressAria: 'ප්‍රගතිය {{done}}/{{total}}, {{pct}}%',
  resultReflect: 'ප්‍රතිඵල',
  assignSummary: 'කම්කරු {{workers}} · ක්‍රියාවලි {{processes}} ({{names}})',
  line: 'රේඛාව',
  worker: 'කම්කරු',
  lot: 'LOT',
  product: 'නිෂ්පාදනය',
  remainingQty: 'ඉතිරි ප්‍රමාණය',
  qtyInputTitle: 'ප්‍රමාණ ඇතුළත් කරන්න',
  holdBanner: 'මෙම LOT වැඩ අනුපාතය HOLD තත්වයේය.',
  holdReason: ' හේතුව: {{reason}}',
  targetProcess: 'ලියාපදිංචි ක්‍රියාවලිය',
  fillRemaining: 'ඉතිරි ප්‍රමාණය පුරවන්න ({{qty}})',
  input: 'ආදාන',
  good: 'හොඳ',
  defect: 'දෝෂ',
  defectDetailTitle: 'වර්ගය අනුව දෝෂ',
  defectTotal: 'දෝෂ {{defect}} · එකතුව {{sum}}',
  defectShort: '{{n}} අඩු',
  defectOver: '{{n}} අධික',
  noDefectTypes: 'මෙම නිෂ්පාදනයට දෝෂ වර්ග නැත.',
  defectTypeAria: 'දෝෂ වර්ගය',
  defectQtyAria: 'දෝෂ ප්‍රමාණය',
  removeRow: 'පේළිය මකන්න',
  addDefectType: '+ වර්ගය එක් කරන්න',
  confirmTitle: 'ඇතුළත් කිරීම සමාලෝචනය',
  sumCheck: 'එකතුව පරීක්ෂාව',
  ok: 'OK',
  error: 'දෝෂය',
  saveNote: 'සුරැකීම LOT, දෝෂ ඉතිහාසය සහ ගබඩාව යාවත්කාලීන කරයි.',
  back: 'පෙර',
  next: 'ඊළඟ',
  saving: 'සුරකිමින්…',
  save: 'ප්‍රතිඵල සුරකින්න',
  errSelectLot: 'නිෂ්පාදන LOT තෝරන්න.',
  errHold: 'වැඩ අනුපාතය රඳවා ඇත. නැවත ආරම්භ කර ඇතුළත් කරන්න.',
  errNoWorkerAssign: 'ක්‍රියාවලිය අනුව කම්කරු පවරා නැත. පරිපාලක අමතන්න.',
  errNoProcess: 'ක්‍රියාවලි නැත. MBOM ලියාපදිංචිය ඉල්ලන්න.',
  errInputQty: 'ආදාන ප්‍රමාණය ඇතුළත් කරන්න.',
  errQtyOver: 'හොඳ + දෝෂ ආදානය ඉක්මවිය නොහැක.',
  errQtyZero: 'හොඳ හෝ දෝෂ ප්‍රමාණය ඇතුළත් කරන්න.',
  errNoDefectTypeReg: 'දෝෂ වර්ග ලියාපදිංචි නැත. පරිපාලක අමතන්න.',
  errSelectDefectType: 'දෝෂ වර්ගය තෝරන්න.',
  errDefectSum: 'වර්ග එකතුව ({{sum}}) දෝෂ ප්‍රමාණයට ({{defect}}) සමාන විය යුතුය.',
}

export const WI_MESSAGES: Record<WiLocale, WiMessages> = { ko, en, zh, vi, th, si }

export type WiMessageKey = keyof WiMessages

export function formatWiMessage(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key]
    return v != null ? String(v) : ''
  })
}
