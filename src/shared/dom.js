export function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export function won(amount) {
  if (amount === null || amount === undefined) return '배송 불가';
  return Number(amount).toLocaleString('ko-KR') + '원';
}

export function hoursText(hours) {
  if (hours === null || hours === undefined) return '적재 불가';
  return `${hours}시간`;
}
