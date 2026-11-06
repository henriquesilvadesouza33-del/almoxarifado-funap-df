// ===== DATABASE (localStorage) =====
const DB_KEY = 'funap_almoxarifado';
const USERS_KEY = 'funap_users';

function getDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const db = { materiais: [], movimentos: [], oficios: [], nextMatId: 1, nextMovId: 1, nextOfId: 1 };
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }
  return JSON.parse(raw);
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function getUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) {
    const users = [
      { user: 'admin', pass: 'funap2026', name: 'Administrador', role: 'admin' },
      { user: 'almoxarife', pass: 'funap123', name: 'Almoxarife', role: 'operador' },
      { user: 'consulta', pass: 'consulta1', name: 'Consultor', role: 'consulta' }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return users;
  }
  return JSON.parse(raw);
}

let currentUser = null;
let currentMovType = 'saida';
let lastCaptureData = null;

// ===== LOGIN =====
function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const users = getUsers();
  const found = users.find(u => u.user === user && u.pass === pass);
  if (found) {
    currentUser = found;
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('appScreen').classList.add('active');
    document.getElementById('userName').textContent = found.name;
    document.getElementById('loginError').textContent = '';
    refreshAll();
  } else {
    document.getElementById('loginError').textContent = 'Usuário ou senha incorretos';
  }
}

function doLogout() {
  if (!confirm('Deseja sair do sistema?')) return;
  currentUser = null;
  document.getElementById('appScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.add('active');
  document.getElementById('loginPass').value = '';
  navigateTo('home');
}

// Enter key no login
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('loginPass').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('loginUser').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
});

// ===== NAVIGATION =====
function navigateTo(page) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));
  document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1)).classList.add('active');
  
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-page="${page}"]`).classList.add('active');
  
  if (page === 'home') refreshDashboard();
  if (page === 'estoque') refreshEstoque();
  if (page === 'movimentos') refreshMovimentos();
  if (page === 'relatorios') refreshRelatorios();
  
  window.scrollTo(0, 0);
}

// ===== REFRESH ALL =====
function refreshAll() {
  setCurrentDate();
  refreshDashboard();
  refreshEstoque();
  refreshMovimentos();
  refreshRelatorios();
  updateNotifBadge();
}

function setCurrentDate() {
  const now = new Date();
  const options = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  document.getElementById('currentDate').textContent = now.toLocaleDateString('pt-BR', options);
}

// ===== DASHBOARD =====
function refreshDashboard() {
  const db = getDB();
  const totalMat = db.materiais.length;
  const totalUni = db.materiais.reduce((s, m) => s + m.quantidade, 0);
  const totalCat = [...new Set(db.materiais.map(m => m.categoria))].length;
  const totalMov = db.movimentos.length;
  
  document.getElementById('statMateriais').textContent = totalMat;
  document.getElementById('statUnidades').textContent = totalUni;
  document.getElementById('statCategorias').textContent = totalCat;
  document.getElementById('statMovimentos').textContent = totalMov;
  
  // Recent movements
  const recent = document.getElementById('recentMovements');
  if (db.movimentos.length === 0) {
    recent.innerHTML = '<p class="empty-msg">Nenhuma movimentação registrada</p>';
  } else {
    const last5 = db.movimentos.slice(-5).reverse();
    recent.innerHTML = last5.map(m => `
      <div class="mov-card ${m.tipo}">
        <div class="mov-top">
          <span class="mov-type">
            <i class="fas fa-${m.tipo === 'entrada' ? 'arrow-down' : 'arrow-up'}"></i>
            ${m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
          </span>
          <span class="mov-date">${formatDate(m.data)}</span>
        </div>
        <div class="mov-body">
          <h4>${m.materialNome || 'Material #' + m.materialId}</h4>
          <p>Qtd: ${m.quantidade} | ${m.destino || m.setor || '-'}</p>
        </div>
      </div>
    `).join('');
  }
}

// ===== ESTOQUE =====
function refreshEstoque() {
  const db = getDB();
  
  // Update category filter
  const cats = [...new Set(db.materiais.map(m => m.categoria))].sort();
  const filter = document.getElementById('filterCategoria');
  filter.innerHTML = '<option value="">Todas categorias</option>';
  cats.forEach(c => filter.innerHTML += `<option value="${c}">${c}</option>`);
  
  renderEstoqueList(db.materiais);
}

function renderEstoqueList(list) {
  const el = document.getElementById('estoqueList');
  if (list.length === 0) {
    el.innerHTML = '<p class="empty-msg">Nenhum material cadastrado</p>';
    return;
  }
  el.innerHTML = list.map(m => {
    const catIcons = {
      'Limpeza':'fa-broom','Ferramentas':'fa-wrench','Construção':'fa-hard-hat',
      'Uniformes':'fa-shirt','Escritório':'fa-pen','Tecnologia':'fa-laptop',
      'Móveis':'fa-couch','Alimentação':'fa-utensils','Outros':'fa-box'
    };
    const icon = catIcons[m.categoria] || 'fa-box';
    return `
      <div class="mat-card" onclick="showDetalhes(${m.id})">
        <div class="mat-icon"><i class="fas ${icon}"></i></div>
        <div class="mat-info">
          <h4>${m.nome}</h4>
          <p>${m.categoria} | ${m.codigo || 'Sem código'} | ${m.localizacao || '-'}</p>
        </div>
        <div class="mat-qty">
          <span class="qty-val">${m.quantidade}</span>
          <span class="qty-unit">${m.unidade || 'un'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function filterEstoque() {
  const db = getDB();
  const search = document.getElementById('searchEstoque').value.toLowerCase();
  const cat = document.getElementById('filterCategoria').value;
  let list = db.materiais;
  if (search) list = list.filter(m => m.nome.toLowerCase().includes(search) || (m.codigo||'').toLowerCase().includes(search));
  if (cat) list = list.filter(m => m.categoria === cat);
  renderEstoqueList(list);
}

// ===== MOVIMENTOS =====
function refreshMovimentos() {
  const db = getDB();
  renderMovimentosList(db.movimentos);
}

function renderMovimentosList(list) {
  const el = document.getElementById('movimentosList');
  if (list.length === 0) {
    el.innerHTML = '<p class="empty-msg">Nenhuma movimentação registrada</p>';
    return;
  }
  const sorted = [...list].reverse();
  el.innerHTML = sorted.map(m => `
    <div class="mov-card ${m.tipo}">
      <div class="mov-top">
        <span class="mov-type">
          <i class="fas fa-${m.tipo === 'entrada' ? 'arrow-down' : 'arrow-up'}"></i>
          ${m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </span>
        <span class="mov-date">${formatDate(m.data)}</span>
      </div>
      <div class="mov-body">
        <h4>${m.materialNome || 'Material #' + m.materialId}</h4>
        <p>Qtd: ${m.quantidade} | Destino: ${m.destino || '-'} | Recebedor: ${m.recebedor || '-'}</p>
        <div class="mov-detail">
          <span><i class="fas fa-tag"></i> ${m.finalidade || '-'}</span>
          <span><i class="fas fa-user"></i> ${m.responsavel || '-'}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function filterMovimentos() {
  const db = getDB();
  const search = document.getElementById('searchMovimentos').value.toLowerCase();
  const tipo = document.getElementById('filterTipoMov').value;
  const data = document.getElementById('filterDataMov').value;
  let list = db.movimentos;
  if (search) list = list.filter(m => (m.materialNome||'').toLowerCase().includes(search) || (m.destino||'').toLowerCase().includes(search) || (m.recebedor||'').toLowerCase().includes(search));
  if (tipo) list = list.filter(m => m.tipo === tipo);
  if (data) list = list.filter(m => m.data === data);
  renderMovimentosList(list);
}

// ===== NOVO MATERIAL =====
function showNovoMaterial() {
  document.getElementById('matNome').value = '';
  document.getElementById('matCodigo').value = '';
  document.getElementById('matCategoria').value = '';
  document.getElementById('matQuantidade').value = '';
  document.getElementById('matUnidade').value = 'un';
  document.getElementById('matLocalizacao').value = '';
  document.getElementById('matObs').value = '';
  openModal('modalNovoMaterial');
}

function saveMaterial() {
  const nome = document.getElementById('matNome').value.trim();
  const categoria = document.getElementById('matCategoria').value;
  const quantidade = parseInt(document.getElementById('matQuantidade').value) || 0;
  
  if (!nome || !categoria || quantidade < 0) {
    showToast('Preencha os campos obrigatórios', true);
    return;
  }
  
  const db = getDB();
  const mat = {
    id: db.nextMatId++,
    nome,
    codigo: document.getElementById('matCodigo').value.trim(),
    categoria,
    quantidade,
    unidade: document.getElementById('matUnidade').value,
    localizacao: document.getElementById('matLocalizacao').value.trim(),
    obs: document.getElementById('matObs').value.trim(),
    dataCadastro: new Date().toISOString().split('T')[0],
    ativo: true
  };
  db.materiais.push(mat);
  saveDB(db);
  closeModal('modalNovoMaterial');
  showToast('Material cadastrado com sucesso!');
  refreshAll();
}

// ===== DETALHES MATERIAL =====
function showDetalhes(id) {
  const db = getDB();
  const mat = db.materiais.find(m => m.id === id);
  if (!mat) return;
  
  const movs = db.movimentos.filter(m => m.materialId === id);
  
  const body = document.getElementById('detalhesBody');
  body.innerHTML = `
    <div style="margin-bottom:16px">
      <h4 style="font-size:18px;color:#1a5c32;margin-bottom:4px">${mat.nome}</h4>
      <p style="font-size:13px;color:#888">Código: ${mat.codigo || 'N/A'} | Categoria: ${mat.categoria}</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:#f0f7f2;padding:12px;border-radius:8px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#1a5c32">${mat.quantidade}</div>
        <div style="font-size:11px;color:#888">${mat.unidade} em estoque</div>
      </div>
      <div style="background:#f0f7f2;padding:12px;border-radius:8px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#2980b9">${movs.filter(m=>m.tipo==='entrada').length}</div>
        <div style="font-size:11px;color:#888">Entradas</div>
      </div>
    </div>
    <div style="margin-bottom:8px"><strong>Localização:</strong> ${mat.localizacao || 'Não informada'}</div>
    <div style="margin-bottom:8px"><strong>Cadastrado em:</strong> ${formatDate(mat.dataCadastro)}</div>
    <div style="margin-bottom:12px"><strong>Observações:</strong> ${mat.obs || 'Nenhuma'}</div>
    <h4 style="font-size:14px;margin-bottom:8px;color:#1a5c32"><i class="fas fa-clock-rotate-left"></i> Histórico de movimentações</h4>
    ${movs.length === 0 ? '<p class="empty-msg">Sem movimentações</p>' : movs.reverse().map(m => `
      <div class="mov-card ${m.tipo}" style="margin-bottom:6px">
        <div class="mov-top">
          <span class="mov-type">
            <i class="fas fa-${m.tipo === 'entrada' ? 'arrow-down' : 'arrow-up'}"></i>
            ${m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
          </span>
          <span class="mov-date">${formatDate(m.data)}</span>
        </div>
        <div class="mov-body">
          <p>Qtd: ${m.quantidade} | ${m.destino||'-'} | ${m.recebedor||'-'}</p>
        </div>
      </div>
    `).join('')}
  `;
  
  // Store for delete
  body.dataset.matId = id;
  openModal('modalDetalhes');
}

function deleteMaterial() {
  const id = parseInt(document.getElementById('detalhesBody').dataset.matId);
  if (!confirm('Tem certeza que deseja excluir este material?')) return;
  const db = getDB();
  db.materiais = db.materiais.filter(m => m.id !== id);
  saveDB(db);
  closeModal('modalDetalhes');
  showToast('Material excluído');
  refreshAll();
}

// ===== MOVIMENTAÇÃO =====
function showMovimentacao(type) {
  currentMovType = type || 'saida';
  
  const db = getDB();
  const sel = document.getElementById('movMaterial');
  sel.innerHTML = '<option value="">Selecione o material...</option>';
  db.materiais.forEach(m => {
    sel.innerHTML += `<option value="${m.id}">${m.nome} (Estoque: ${m.quantidade} ${m.unidade})</option>`;
  });
  
  document.getElementById('movQuantidade').value = '';
  document.getElementById('movData').value = new Date().toISOString().split('T')[0];
  document.getElementById('movDestino').value = '';
  document.getElementById('movRecebedor').value = '';
  document.getElementById('movFinalidade').value = '';
  document.getElementById('movResponsavel').value = currentUser ? currentUser.name : '';
  document.getElementById('movObs').value = '';
  
  updateMovToggle();
  openModal('modalMovimentacao');
}

function setMovType(type) {
  currentMovType = type;
  updateMovToggle();
}

function updateMovToggle() {
  const btnE = document.getElementById('toggleEntrada');
  const btnS = document.getElementById('toggleSaida');
  btnE.className = 'toggle-btn' + (currentMovType === 'entrada' ? ' active-entrada' : '');
  btnS.className = 'toggle-btn' + (currentMovType === 'saida' ? ' active-saida' : '');
  document.getElementById('movModalTitle').innerHTML = `<i class="fas fa-exchange-alt"></i> ${currentMovType === 'entrada' ? 'Entrada' : 'Saída'} de Material`;
}

function saveMovimentacao() {
  const materialId = parseInt(document.getElementById('movMaterial').value);
  const quantidade = parseInt(document.getElementById('movQuantidade').value) || 0;
  const data = document.getElementById('movData').value;
  const destino = document.getElementById('movDestino').value.trim();
  const recebedor = document.getElementById('movRecebedor').value.trim();
  const finalidade = document.getElementById('movFinalidade').value;
  
  if (!materialId || !quantidade || !destino || !recebedor || !finalidade) {
    showToast('Preencha todos os campos obrigatórios', true);
    return;
  }
  
  const db = getDB();
  const mat = db.materiais.find(m => m.id === materialId);
  if (!mat) {
    showToast('Material não encontrado', true);
    return;
  }
  
  if (currentMovType === 'saida' && quantidade > mat.quantidade) {
    showToast('Quantidade insuficiente em estoque!', true);
    return;
  }
  
  // Update stock
  if (currentMovType === 'entrada') {
    mat.quantidade += quantidade;
  } else {
    mat.quantidade -= quantidade;
  }
  
  const mov = {
    id: db.nextMovId++,
    tipo: currentMovType,
    materialId,
    materialNome: mat.nome,
    quantidade,
    unidade: mat.unidade,
    data: data || new Date().toISOString().split('T')[0],
    destino,
    recebedor,
    finalidade,
    responsavel: document.getElementById('movResponsavel').value.trim(),
    obs: document.getElementById('movObs').value.trim(),
    timestamp: new Date().toISOString()
  };
  
  db.movimentos.push(mov);
  saveDB(db);
  closeModal('modalMovimentacao');
  showToast(`${currentMovType === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`);
  refreshAll();
}

// ===== OFÍCIO / CAMERA / IA =====
function captureDocument() {
  document.getElementById('fileInput').click();
}

function handleFileCapture(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('imagePreview').style.display = 'block';
    
    // Simulate AI extraction
    simulateAIExtraction(e.target.result);
  };
  reader.readAsDataURL(file);
}

function clearCapture() {
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('aiResult').style.display = 'none';
  document.getElementById('fileInput').value = '';
}

function simulateAIExtraction(imageData) {
  // Show AI result with placeholder data
  // In production, this would call an OCR/AI API
  showToast('IA processando documento...');
  
  setTimeout(() => {
    document.getElementById('aiResult').style.display = 'block';
    document.getElementById('aiOrgao').value = '';
    document.getElementById('aiNumOficio').value = '';
    document.getElementById('aiDataOficio').value = new Date().toISOString().split('T')[0];
    document.getElementById('aiResponsavelEntrega').value = '';
    
    // Add 3 empty item rows
    document.getElementById('oficioItemsList').innerHTML = '';
    for (let i = 0; i < 3; i++) addOficioItem();
    
    showToast('Documento processado! Revise os dados extraídos.');
  }, 1500);
}

let oficioItemCount = 0;
function addOficioItem() {
  oficioItemCount++;
  const list = document.getElementById('oficioItemsList');
  const row = document.createElement('div');
  row.className = 'oficio-item-row';
  row.id = 'oficioItem' + oficioItemCount;
  row.innerHTML = `
    <input type="text" placeholder="Nome do item" class="oi-nome" style="flex:2">
    <input type="number" placeholder="Qtd" class="oi-qtd" min="0" style="flex:0.5;min-width:60px">
    <select class="oi-unidade" style="flex:0.5;min-width:70px">
      <option value="un">Un</option>
      <option value="cx">Cx</option>
      <option value="pct">Pct</option>
      <option value="kg">Kg</option>
      <option value="lt">Lt</option>
    </select>
    <select class="oi-categoria" style="flex:1;min-width:100px">
      <option value="Limpeza">Limpeza</option>
      <option value="Ferramentas">Ferramentas</option>
      <option value="Construção">Construção</option>
      <option value="Uniformes">Uniformes</option>
      <option value="Escritório">Escritório</option>
      <option value="Tecnologia">Tecnologia</option>
      <option value="Móveis">Móveis</option>
      <option value="Alimentação">Alimentação</option>
      <option value="Outros">Outros</option>
    </select>
    <button class="btn-remove" onclick="removeOficioItem('oficioItem${oficioItemCount}')"><i class="fas fa-times"></i></button>
  `;
  list.appendChild(row);
}

function removeOficioItem(id) {
  document.getElementById(id).remove();
}

function registerOficio() {
  const orgao = document.getElementById('aiOrgao').value.trim();
  const numOficio = document.getElementById('aiNumOficio').value.trim();
  const dataOficio = document.getElementById('aiDataOficio').value;
  const responsavel = document.getElementById('aiResponsavelEntrega').value.trim();
  
  if (!orgao || !numOficio) {
    showToast('Preencha órgão e número do ofício', true);
    return;
  }
  
  const db = getDB();
  const items = document.querySelectorAll('.oficio-item-row');
  let registered = 0;
  
  items.forEach(row => {
    const nome = row.querySelector('.oi-nome').value.trim();
    const qtd = parseInt(row.querySelector('.oi-qtd').value) || 0;
    const unidade = row.querySelector('.oi-unidade').value;
    const categoria = row.querySelector('.oi-categoria').value;
    
    if (nome && qtd > 0) {
      const mat = {
        id: db.nextMatId++,
        nome,
        codigo: 'OF-' + numOficio.replace(/[^a-zA-Z0-9]/g, ''),
        categoria,
        quantidade: qtd,
        unidade,
        localizacao: '',
        obs: `Recebido via ofício ${numOficio} de ${orgao}`,
        dataCadastro: new Date().toISOString().split('T')[0],
        ativo: true
      };
      db.materiais.push(mat);
      
      // Also register as entrada movement
      const mov = {
        id: db.nextMovId++,
        tipo: 'entrada',
        materialId: mat.id,
        materialNome: mat.nome,
        quantidade: qtd,
        unidade: mat.unidade,
        data: dataOficio || new Date().toISOString().split('T')[0],
        destino: 'Almoxarifado Funap DF',
        recebedor: responsavel || 'Receptor não informado',
        finalidade: 'Doação',
        responsavel: currentUser ? currentUser.name : '',
        obs: `Ofício ${numOficio} - ${orgao}`,
        timestamp: new Date().toISOString()
      };
      db.movimentos.push(mov);
      registered++;
    }
  });
  
  // Save ofício record
  const oficio = {
    id: db.nextOfId++,
    orgao,
    numOficio,
    dataOficio,
    responsavel,
    itensRegistrados: registered,
    dataRegistro: new Date().toISOString()
  };
  if (!db.oficios) db.oficios = [];
  db.oficios.push(oficio);
  
  saveDB(db);
  
  if (registered > 0) {
    showToast(`${registered} material(is) registrado(s) com sucesso!`);
    clearCapture();
    refreshAll();
    navigateTo('home');
  } else {
    showToast('Nenhum item válido para registrar. Preencha nome e quantidade.', true);
  }
}

// ===== TERMO DE RECEBIMENTO =====
function emitirRecebimento() {
  const db = getDB();
  if (db.materiais.length === 0) {
    showToast('Nenhum material para emitir termo', true);
    return;
  }
  
  const lastOficio = db.oficios && db.oficios.length > 0 ? db.oficios[db.oficios.length - 1] : null;
  
  const today = new Date().toLocaleDateString('pt-BR');
  const body = document.getElementById('recebimentoBody');
  
  let itemsHTML = '';
  if (lastOficio) {
    const relatedMats = db.materiais.filter(m => m.codigo && m.codigo.includes(lastOficio.numOficio.replace(/[^a-zA-Z0-9]/g, '')));
    if (relatedMats.length > 0) {
      itemsHTML = relatedMats.map(m => `
        <tr>
          <td>${m.nome}</td>
          <td>${m.quantidade}</td>
          <td>${m.unidade}</td>
          <td>${m.categoria}</td>
        </tr>
      `).join('');
    }
  }
  if (!itemsHTML) {
    itemsHTML = db.materiais.slice(-5).map(m => `
      <tr>
        <td>${m.nome}</td>
        <td>${m.quantidade}</td>
        <td>${m.unidade}</td>
        <td>${m.categoria}</td>
      </tr>
    `).join('');
  }
  
  body.innerHTML = `
    <div class="recebimento-doc">
      <div class="doc-header">
        <div style="display:flex;justify-content:center;gap:16px;margin-bottom:10px">
          <span class="gdf-badge">GDF</span>
          <span class="funap-badge" style="background:#1a5c32;color:#fff;border:none">FUNAP</span>
        </div>
        <h2>TERMO DE RECEBIMENTO</h2>
        <p class="doc-subtitle">Fundação de Apoio ao Trabalhador Preso - DF</p>
      </div>
      <div class="doc-body">
        <p><strong>Data do recebimento:</strong> ${today}</p>
        ${lastOficio ? `<p><strong>Ofício:</strong> ${lastOficio.numOficio} | <strong>Órgão de origem:</strong> ${lastOficio.orgao}</p>` : ''}
        <p>Declaro para os devidos fins que os materiais abaixo relacionados foram recebidos em perfeitas condições, passando a integrar o patrimônio do Almoxarifado da FUNAP - DF, sob a responsabilidade do setor de almoxarifado.</p>
        
        <table class="report-table" style="margin-top:12px">
          <thead>
            <tr>
              <th>Material</th>
              <th>Quantidade</th>
              <th>Unidade</th>
              <th>Categoria</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}</tbody>
        </table>
        
        <div class="signatures">
          <div class="sig-block">
            <div class="sig-line">Entregador</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">Receptor (Almoxarifado FUNAP)</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">Responsável Técnico</div>
          </div>
        </div>
      </div>
    </div>
  `;
  openModal('modalRecebimento');
}

function printRecebimento() {
  const content = document.getElementById('recebimentoBody').innerHTML;
  const w = window.open('', '', 'width=800,height=600');
  w.document.write(`
    <html><head>
      <title>Termo de Recebimento - Funap DF</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#333}
        .gdf-badge,.funap-badge{padding:4px 12px;border-radius:12px;font-weight:700;font-size:11px;display:inline-block}
        .gdf-badge{background:#f5f0d0;color:#8b7d3c;border:1px solid #d4c87a}
        .funap-badge{background:#1a5c32;color:#fff}
        .doc-header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1a5c32;padding-bottom:14px}
        .doc-header h2{color:#1a5c32;font-size:18px;margin:8px 0 4px}
        .doc-subtitle{color:#8b7d3c;font-size:11px}
        .doc-body p{font-size:12px;line-height:1.6;margin-bottom:8px}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
        th{background:#1a5c32;color:#fff;padding:6px;text-align:left}
        td{padding:6px;border-bottom:1px solid #ddd}
        .signatures{display:flex;justify-content:space-around;margin-top:40px}
        .sig-block{text-align:center;min-width:120px}
        .sig-line{border-top:1px solid #333;margin-top:30px;padding-top:4px;font-size:10px;color:#555}
      </style>
    </head><body>${content}</body></html>
  `);
  w.document.close();
  w.print();
}

// ===== RELATÓRIOS =====
function refreshRelatorios() {
  const db = getDB();
  const entradas = db.movimentos.filter(m => m.tipo === 'entrada').length;
  const saidas = db.movimentos.filter(m => m.tipo === 'saida').length;
  document.getElementById('relEntradas').textContent = entradas;
  document.getElementById('relSaidas').textContent = saidas;
}

function showFechamentoDiario() {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const todayMovs = db.movimentos.filter(m => m.data === today);
  
  const entradas = todayMovs.filter(m => m.tipo === 'entrada');
  const saidas = todayMovs.filter(m => m.tipo === 'saida');
  const qtdEnt = entradas.reduce((s, m) => s + m.quantidade, 0);
  const qtdSai = saidas.reduce((s, m) => s + m.quantidade, 0);
  
  document.getElementById('relModalTitle').innerHTML = '<i class="fas fa-calendar-day"></i> Fechamento Diário';
  document.getElementById('relModalBody').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <h3 style="color:#1a5c32;font-size:16px">Fechamento do dia ${formatDate(today)}</h3>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:#eaf3fa;padding:14px;border-radius:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#2980b9">${entradas.length}</div>
        <div style="font-size:11px;color:#888">Entradas (${qtdEnt} itens)</div>
      </div>
      <div style="background:#fdf0f0;padding:14px;border-radius:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#e74c3c">${saidas.length}</div>
        <div style="font-size:11px;color:#888">Saídas (${qtdSai} itens)</div>
      </div>
    </div>
    ${todayMovs.length === 0 ? '<p class="empty-msg">Nenhuma movimentação hoje</p>' : `
    <table class="report-table">
      <thead>
        <tr><th>Tipo</th><th>Material</th><th>Qtd</th><th>Destino</th><th>Responsável</th></tr>
      </thead>
      <tbody>
        ${todayMovs.map(m => `
          <tr class="${m.tipo}-row">
            <td>${m.tipo === 'entrada' ? '↓ Entrada' : '↑ Saída'}</td>
            <td>${m.materialNome}</td>
            <td>${m.quantidade}</td>
            <td>${m.destino||'-'}</td>
            <td>${m.responsavel||'-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`}
  `;
  openModal('modalRelatorio');
}

function showFechamentoMensal() {
  const db = getDB();
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthStr = now.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
  
  const monthMovs = db.movimentos.filter(m => {
    const d = new Date(m.data);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  
  const entradas = monthMovs.filter(m => m.tipo === 'entrada');
  const saidas = monthMovs.filter(m => m.tipo === 'saida');
  const qtdEnt = entradas.reduce((s, m) => s + m.quantidade, 0);
  const qtdSai = saidas.reduce((s, m) => s + m.quantidade, 0);
  
  document.getElementById('relModalTitle').innerHTML = '<i class="fas fa-calendar-alt"></i> Fechamento Mensal';
  document.getElementById('relModalBody').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <h3 style="color:#1a5c32;font-size:16px">Fechamento de ${monthStr}</h3>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:#eaf3fa;padding:14px;border-radius:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#2980b9">${entradas.length}</div>
        <div style="font-size:10px;color:#888">Entradas (${qtdEnt} itens)</div>
      </div>
      <div style="background:#fdf0f0;padding:14px;border-radius:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#e74c3c">${saidas.length}</div>
        <div style="font-size:10px;color:#888">Saídas (${qtdSai} itens)</div>
      </div>
      <div style="background:#f0f7f2;padding:14px;border-radius:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#1a5c32">${db.materiais.reduce((s,m) => s+m.quantidade, 0)}</div>
        <div style="font-size:10px;color:#888">Estoque total</div>
      </div>
    </div>
    ${monthMovs.length === 0 ? '<p class="empty-msg">Nenhuma movimentação neste mês</p>' : `
    <table class="report-table">
      <thead>
        <tr><th>Data</th><th>Tipo</th><th>Material</th><th>Qtd</th><th>Destino</th></tr>
      </thead>
      <tbody>
        ${monthMovs.map(m => `
          <tr class="${m.tipo}-row">
            <td>${formatDate(m.data)}</td>
            <td>${m.tipo === 'entrada' ? '↓ Entrada' : '↑ Saída'}</td>
            <td>${m.materialNome}</td>
            <td>${m.quantidade}</td>
            <td>${m.destino||'-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`}
  `;
  openModal('modalRelatorio');
}

function showExtratoGeral() {
  const db = getDB();
  document.getElementById('relModalTitle').innerHTML = '<i class="fas fa-list-alt"></i> Extrato Geral';
  document.getElementById('relModalBody').innerHTML = `
    <h4 style="color:#1a5c32;margin-bottom:12px">Total de movimentações: ${db.movimentos.length}</h4>
    ${db.movimentos.length === 0 ? '<p class="empty-msg">Nenhuma movimentação registrada</p>' : `
    <table class="report-table">
      <thead>
        <tr><th>Data</th><th>Tipo</th><th>Material</th><th>Qtd</th><th>Destino</th><th>Recebedor</th><th>Finalidade</th></tr>
      </thead>
      <tbody>
        ${[...db.movimentos].reverse().map(m => `
          <tr class="${m.tipo}-row">
            <td>${formatDate(m.data)}</td>
            <td>${m.tipo === 'entrada' ? '↓ Ent' : '↑ Sai'}</td>
            <td>${m.materialNome}</td>
            <td>${m.quantidade}</td>
            <td>${m.destino||'-'}</td>
            <td>${m.recebedor||'-'}</td>
            <td>${m.finalidade||'-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`}
  `;
  openModal('modalRelatorio');
}

function showPlanilha() {
  const db = getDB();
  document.getElementById('relModalTitle').innerHTML = '<i class="fas fa-table"></i> Planilha Completa';
  document.getElementById('relModalBody').innerHTML = `
    <h4 style="color:#1a5c32;margin-bottom:4px">Estoque Atual</h4>
    <p style="font-size:12px;color:#888;margin-bottom:12px">${db.materiais.length} materiais cadastrados</p>
    ${db.materiais.length === 0 ? '<p class="empty-msg">Nenhum material</p>' : `
    <table class="report-table">
      <thead>
        <tr><th>Código</th><th>Material</th><th>Categoria</th><th>Qtd</th><th>Un</th><th>Local</th></tr>
      </thead>
      <tbody>
        ${db.materiais.map(m => `
          <tr>
            <td>${m.codigo||'-'}</td>
            <td>${m.nome}</td>
            <td>${m.categoria}</td>
            <td>${m.quantidade}</td>
            <td>${m.unidade}</td>
            <td>${m.localizacao||'-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`}
  `;
  openModal('modalRelatorio');
}

function showRelatorioPatrimonio() {
  const db = getDB();
  const cats = {};
  db.materiais.forEach(m => {
    if (!cats[m.categoria]) cats[m.categoria] = { count: 0, qtd: 0 };
    cats[m.categoria].count++;
    cats[m.categoria].qtd += m.quantidade;
  });
  
  document.getElementById('relModalTitle').innerHTML = '<i class="fas fa-building"></i> Relatório Patrimonial';
  document.getElementById('relModalBody').innerHTML = `
    <h4 style="color:#1a5c32;margin-bottom:12px">Visão geral do patrimônio</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:#f0f7f2;padding:14px;border-radius:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#1a5c32">${db.materiais.length}</div>
        <div style="font-size:10px;color:#888">Tipos de materiais</div>
      </div>
      <div style="background:#f0f7f2;padding:14px;border-radius:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#1a5c32">${db.materiais.reduce((s,m)=>s+m.quantidade,0)}</div>
        <div style="font-size:10px;color:#888">Total em estoque</div>
      </div>
    </div>
    <h5 style="font-size:13px;margin-bottom:8px">Por Categoria</h5>
    <table class="report-table">
      <thead>
        <tr><th>Categoria</th><th>Itens</th><th>Quantidade Total</th></tr>
      </thead>
      <tbody>
        ${Object.entries(cats).map(([k,v]) => `
          <tr><td>${k}</td><td>${v.count}</td><td>${v.qtd}</td></tr>
        `).join('')}
      </tbody>
    </table>
  `;
  openModal('modalRelatorio');
}

// ===== EXPORT CSV =====
let currentReportCSV = '';

function exportCSV() {
  const tables = document.querySelectorAll('#relModalBody table');
  if (tables.length === 0) {
    showToast('Nenhum dado para exportar', true);
    return;
  }
  const table = tables[0];
  let csv = '';
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    const cols = row.querySelectorAll('th, td');
    const vals = [];
    cols.forEach(col => vals.push('"' + col.textContent.replace(/"/g, '""') + '"'));
    csv += vals.join(';') + '\n';
  });
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio_funap_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Arquivo CSV exportado!');
}

function printRelatorio() {
  const content = document.getElementById('relModalBody').innerHTML;
  const title = document.getElementById('relModalTitle').textContent;
  const w = window.open('', '', 'width=800,height=600');
  w.document.write(`
    <html><head>
      <title>${title} - Funap DF</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#333}
        h3,h4,h5{color:#1a5c32}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
        th{background:#1a5c32;color:#fff;padding:6px;text-align:left}
        td{padding:6px;border-bottom:1px solid #ddd}
        .entrada-row{color:#2980b9}
        .saida-row{color:#e74c3c}
        .empty-msg{color:#bbb;font-size:14px;text-align:center;padding:20px}
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:16px">
        <strong style="font-size:10px;color:#8b7d3c">GDF</strong> | 
        <strong style="font-size:10px;color:#1a5c32">FUNAP - DF</strong>
      </div>
      <h3 style="text-align:center">${title}</h3>
      ${content}
      <p style="text-align:center;margin-top:20px;font-size:9px;color:#999">
        Sistema Almoxarifado Funap DF | Desenvolvido por Henrique Silva de Souza
      </p>
    </body></html>
  `);
  w.document.close();
  w.print();
}

// ===== NOTIFICATIONS =====
function showNotifications() {
  const db = getDB();
  const lowStock = db.materiais.filter(m => m.quantidade <= 2 && m.quantidade > 0);
  const zeroStock = db.materiais.filter(m => m.quantidade === 0);
  
  let msg = '';
  if (lowStock.length > 0) msg += `⚠️ ${lowStock.length} material(is) com estoque baixo\n`;
  if (zeroStock.length > 0) msg += `🚨 ${zeroStock.length} material(is) sem estoque\n`;
  
  if (!msg) msg = '✅ Nenhuma notificação pendente';
  
  alert(msg);
}

// ===== MODAL HELPERS =====
function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

// ===== TOAST =====
function showToast(msg, isError) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== UTILS =====
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// ===== UPDATE NOTIFICATION BADGE =====
function updateNotifBadge() {
  const db = getDB();
  const low = db.materiais.filter(m => m.quantidade <= 2).length;
  const badge = document.getElementById('notifBadge');
  if (badge) {
    badge.textContent = low;
    badge.style.display = low > 0 ? 'flex' : 'none';
  }
}

// ===== INITIAL DATA (demo) =====
function loadDemoData() {
  const db = getDB();
  if (db.materiais.length > 0) return; // Already has data
  
  const demoMats = [
    { nome:'Cola branca', codigo:'LIMP-001', categoria:'Limpeza', quantidade:24, unidade:'un', localizacao:'Prateleira A1', obs:'' },
    { nome:'Detergente 500ml', codigo:'LIMP-002', categoria:'Limpeza', quantidade:36, unidade:'un', localizacao:'Prateleira A2', obs:'' },
    { nome:'Martelo de unha', codigo:'FERR-001', categoria:'Ferramentas', quantidade:8, unidade:'un', localizacao:'Armário B1', obs:'' },
    { nome:'Trena 5m', codigo:'FERR-002', categoria:'Ferramentas', quantidade:4, unidade:'un', localizacao:'Armário B1', obs:'' },
    { nome:'Cimento CP-II 50kg', codigo:'CONST-001', categoria:'Construção', quantidade:120, unidade:'un', localizacao:'Pátio C1', obs:'' },
    { nome:'Areia lavada', codigo:'CONST-002', categoria:'Construção', quantidade:5, unidade:'m3', localizacao:'Pátio C2', obs:'' },
    { nome:'Camiseta azul P', codigo:'UNI-001', categoria:'Uniformes', quantidade:50, unidade:'un', localizacao:'Prateleira D1', obs:'Tamanho P' },
    { nome:'Calça bege M', codigo:'UNI-002', categoria:'Uniformes', quantidade:30, unidade:'un', localizacao:'Prateleira D2', obs:'Tamanho M' },
    { nome:'Papel A4', codigo:'ESC-001', categoria:'Escritório', quantidade:15, unidade:'cx', localizacao:'Armário E1', obs:'' },
    { nome:'Cabos de rede', codigo:'TEC-001', categoria:'Tecnologia', quantidade:20, unidade:'un', localizacao:'Armário F1', obs:'' },
  ];
  
  demoMats.forEach((d, i) => {
    db.materiais.push({
      id: db.nextMatId++,
      ...d,
      dataCadastro: '2026-08-01',
      ativo: true
    });
  });
  
  const demoMovs = [
    { tipo:'entrada', materialId:1, materialNome:'Cola branca', quantidade:24, unidade:'un', data:'2026-08-01', destino:'Almoxarifado', recebedor:'Carlos Mendes', finalidade:'Doação', responsavel:'Administrador', obs:'Doação PCDF' },
    { tipo:'saida', materialId:1, materialNome:'Cola branca', quantidade:5, unidade:'un', data:'2026-08-05', destino:'Presídio Papuda', recebedor:'João Pereira', finalidade:'Limpeza', responsavel:'Administrador', obs:'' },
    { tipo:'entrada', materialId:5, materialNome:'Cimento CP-II 50kg', quantidade:120, unidade:'un', data:'2026-08-03', destino:'Almoxarifado', recebedor:'Carlos Mendes', finalidade:'Doação', responsavel:'Administrador', obs:'Doação COHAB' },
    { tipo:'saida', materialId:5, materialNome:'Cimento CP-II 50kg', quantidade:20, unidade:'un', data:'2026-08-10', destino:'Obra COLMEIA', recebedor:'Pedro Santos', finalidade:'Construção', responsavel:'Administrador', obs:'Obra de reforma' },
    { tipo:'saida', materialId:7, materialNome:'Camiseta azul P', quantidade:15, unidade:'un', data:'2026-08-12', destino:'Presídio Papuda', recebedor:'Maria Silva', finalidade:'Uniformes', responsavel:'Administrador', obs:'Distribuição trimestral' },
  ];
  
  demoMovs.forEach(d => {
    db.movimentos.push({ id: db.nextMovId++, ...d, timestamp: d.data + 'T10:00:00Z' });
  });
  
  saveDB(db);
}

// ===== INIT =====
loadDemoData();
