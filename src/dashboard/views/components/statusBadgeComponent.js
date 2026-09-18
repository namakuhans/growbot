function renderStatusBadge(text, type = 'inactive') {
  return `<span class="status-badge badge-${type}">${text}</span>`;
}

module.exports = { renderStatusBadge };
