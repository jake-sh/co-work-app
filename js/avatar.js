'use strict';
/* ═══════════════════════════════════════════════
   Avatar — 20×20 픽셀 아트 에디터
═══════════════════════════════════════════════ */
const Avatar = (() => {
  const SIZE = 20;
  const PALETTE = [
    '#000000','#FFFFFF','#C8E821','#FF7A00','#FF4D5E','#3B8BFF',
    '#9B6DFF','#2ECC71','#FFD93B','#FF6FB5','#8B5E3C','#A0A0A0',
    '#1A1A1A','#E89B6C','#6B9BD8','transparent'
  ];
  let _grid = [];
  let _curColor = '#000000';
  let _isErase = false;
  let _painting = false;

  function _blank() {
    return Array.from({length:SIZE*SIZE}, () => 'transparent');
  }

  // localStorage(pixel) → dataURL 변환
  function gridToDataURL(grid) {
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const ctx = c.getContext('2d');
    grid.forEach((color, i) => {
      if (color && color !== 'transparent') {
        ctx.fillStyle = color;
        ctx.fillRect(i % SIZE, Math.floor(i / SIZE), 1, 1);
      }
    });
    return c.toDataURL();
  }

  function _renderBoard() {
    const board = document.getElementById('pixel-board');
    if (!board) return;
    board.innerHTML = _grid.map((col, i) =>
      `<div class="pixel-cell" data-i="${i}" style="background:${col==='transparent'?'#fff':col}"></div>`
    ).join('');

    const paint = (cell) => {
      const i = +cell.dataset.i;
      _grid[i] = _isErase ? 'transparent' : _curColor;
      cell.style.background = _grid[i]==='transparent' ? '#fff' : _grid[i];
    };

    board.onpointerdown = e => {
      if (e.target.classList.contains('pixel-cell')) { _painting = true; paint(e.target); }
    };
    board.onpointermove = e => {
      if (!_painting) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.classList.contains('pixel-cell')) paint(el);
    };
    board.onpointerup = () => { _painting = false; };
    board.onpointerleave = () => { _painting = false; };
  }

  function _renderPalette() {
    const pal = document.getElementById('pixel-palette');
    if (!pal) return;
    pal.innerHTML = PALETTE.map(c =>
      `<div class="pixel-color ${c===_curColor?'selected':''}"
        data-color="${c}"
        style="background:${c==='transparent'?'repeating-conic-gradient(#ccc 0% 25%,#fff 0% 50%) 50%/12px 12px':c}"
        onclick="Avatar._pick('${c}')"></div>`
    ).join('');
  }

  function _pick(c) {
    _curColor = c; _isErase = false;
    document.getElementById('erase-tool')?.classList.remove('active');
    _renderPalette();
  }

  function open(currentGrid, onSave) {
    _grid = currentGrid && currentGrid.length === SIZE*SIZE ? [...currentGrid] : _blank();
    _curColor = '#000000'; _isErase = false;

    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${I18n.getLang()==='ko'?'아바타 만들기':'Create Avatar'}</div>
      <div class="modal-body">
        <div class="avatar-editor">
          <div class="pixel-board" id="pixel-board"></div>
          <div class="pixel-palette" id="pixel-palette"></div>
          <div class="pixel-tools">
            <button class="pixel-tool" id="erase-tool" onclick="Avatar._toggleErase()">${I18n.getLang()==='ko'?'지우개':'Eraser'}</button>
            <button class="pixel-tool" onclick="Avatar._clear()">${I18n.getLang()==='ko'?'전체 지우기':'Clear'}</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" style="flex:1" onclick="Modal.close()">${I18n.t('common.cancel')}</button>
        <button class="btn-primary" style="flex:2" onclick="Avatar._save()">${I18n.getLang()==='ko'?'저장':'Save'}</button>
      </div>`;
    Modal.open(html);
    Avatar._onSave = onSave;
    setTimeout(() => { _renderBoard(); _renderPalette(); }, 100);
  }

  function _toggleErase() {
    _isErase = !_isErase;
    document.getElementById('erase-tool')?.classList.toggle('active', _isErase);
  }
  function _clear() {
    _grid = _blank();
    _renderBoard();
  }
  function _save() {
    const dataURL = gridToDataURL(_grid);
    if (Avatar._onSave) Avatar._onSave({ grid: _grid, dataURL });
    Modal.close();
  }

  return { open, gridToDataURL, _pick, _toggleErase, _clear, _save, _onSave:null };
})();
