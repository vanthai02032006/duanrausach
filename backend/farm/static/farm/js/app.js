// Small progressive-enhancement helpers; security and permissions remain enforced by Django.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[onsubmit*="confirm"]').forEach(form => {
    // Existing explicit confirmation handlers are retained for destructive demo actions.
    form.dataset.confirmation = 'enabled';
  });
  document.querySelectorAll('textarea[maxlength]').forEach((textarea) => {
    const hint = document.createElement('small');
    hint.className = 'help-text';
    hint.textContent = `Đã nhập ${textarea.value.length}/${textarea.maxLength} ký tự`;
    textarea.insertAdjacentElement('afterend', hint);
    textarea.addEventListener('input', () => { hint.textContent = `Đã nhập ${textarea.value.length}/${textarea.maxLength} ký tự`; });
  });
});
