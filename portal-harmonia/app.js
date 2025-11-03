// ------------------ UTIL ------------------
    const $ = (sel, root=document) => root.querySelector(sel);
    const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
    const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

    const STORAGE_KEYS = {
      users: 'ph_users',
      session: 'ph_session',
      failed: 'ph_failed_attempts',
      lockout: 'ph_lockout_until',
      products: 'ph_products'
    };

    function getUsers(){
      const base = [
        {username:'admin', password:'1234', role:'administrador', email:'admin@harmonia.app'},
        {username:'oper', password:'1234', role:'operacional', email:'oper@harmonia.app'}
      ];
      const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.users)||'null');
      if(!data){ localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(base)); return base; }
      return data;
    }
    function setUsers(arr){ localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(arr)); }

    function getProducts(){
      const seed=[
        {id: crypto.randomUUID(), name:'Café Premium', price:19.90, stock:50},
        {id: crypto.randomUUID(), name:'Chá Verde', price:12.50, stock:80}
      ];
      const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.products)||'null');
      if(!data){ localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(seed)); return seed; }
      return data;
    }
    function setProducts(arr){ localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(arr)); }

    function getSession(){
      const s = sessionStorage.getItem(STORAGE_KEYS.session) || localStorage.getItem(STORAGE_KEYS.session);
      return s ? JSON.parse(s) : null;
    }
    function setSession(sess, remember){
      const str = JSON.stringify(sess);
      // DEFECT: ignorando 'remember' e sempre usando sessionStorage
      sessionStorage.removeItem(STORAGE_KEYS.session); localStorage.removeItem(STORAGE_KEYS.session);
      sessionStorage.setItem(STORAGE_KEYS.session, str);
    }
    function clearSession(){ sessionStorage.removeItem(STORAGE_KEYS.session); localStorage.removeItem(STORAGE_KEYS.session); }

    function toast(msg){
      const t = $('#toast');
      t.textContent = msg; t.classList.add('show');
      setTimeout(()=> t.classList.remove('show'), 2500);
    }

    function setRoleChip(role){
      const chip = $('#roleChip');
      if(role){ chip.textContent = role; chip.style.display = 'inline-flex'; }
      else chip.style.display = 'none';
    }

    // --------------- ROUTER ---------------
    const routes = {
      '#/login': renderLogin,
      '#/register': renderRegister,
      '#/dashboard': renderDashboard
    };

    function navigate(hash){ location.hash = hash; }

    window.addEventListener('hashchange', () => mount());

    async function mount(){
      const sess = getSession();
      $('#btnGoLogin').style.display = sess ? 'none' : 'inline-flex';
      $('#btnLogout').style.display = sess ? 'inline-flex' : 'none';
      setRoleChip(sess?.role);
      const hash = location.hash || (sess ? '#/dashboard' : '#/login');
      const view = routes[hash] || renderNotFound;
      await view();
    }

    // --------------- VIEWS ---------------
    async function renderLogin(){
      const el = document.getElementById('app');
      el.innerHTML = `
      <div class="grid cols-2">
        <section class="card stack" aria-labelledby="loginTitle">
          <div>
            <h1 id="loginTitle">Bem-vindo ao Portal Harmonia</h1>
            <p class="footer-note">Faça login para acessar o Dashboard de Produtos. Design acessível, rápido e harmonioso nas cores.</p>
          </div>
          <form id="formLogin" class="stack" autocomplete="on" novalidate>
            <div class="row">
              <label for="usuario">Usuário</label>
              <input id="usuario" name="usuario" class="input" required aria-required="true" />
            </div>
            <div class="row">
              <label for="senha">Senha</label>
              <input id="senha" name="senha" type="password" class="input" required aria-required="true" />
            </div>
            <div class="toolbar" style="justify-content: space-between;">
              <label style="display:inline-flex; align-items:center; gap:8px;">
                <input type="checkbox" id="remember" /> Lembrar-me
              </label>
              <div class="toolbar">
                <button class="btn neutral" type="button" id="toRegister">Criar conta</button>
                <button class="btn primary" id="btnLogin" type="submit">
                  <span>Entrar</span>
                </button>
              </div>
            </div>
            <div id="loginMsg" class="status error" style="display:none" role="alert" aria-live="off"></div>
            <div class="footer-note">Dica: admin/1234 (administrador) • oper/1234 (operacional)</div>
          </form>
        </section>
        <section class="card stack" aria-label="Informações">
          <div class="row" style="align-items:center; gap:12px;">
            <div class="loader" aria-hidden="true"></div>
            <div>
              <strong>Características de usabilidade</strong>
              <ul>
                <li>Contraste AA, foco visível e navegação por teclado</li>
                <li>Feedbacks claros: loaders, toasts e mensagens</li>
                <li>Layout responsivo (mobile-first)</li>
              </ul>
            </div>
          </div>
        </section>
      </div>`;

      $('#toRegister').addEventListener('click', ()=> navigate('#/register'));

      $('#formLogin').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const u = $('#usuario').value.trim();
        const p = $('#senha').value;
        const remember = $('#remember').checked;

        const lockUntil = JSON.parse(localStorage.getItem(STORAGE_KEYS.lockout)||'0');
        const now = Date.now();
        if(lockUntil && now < lockUntil){
          const m = Math.ceil((lockUntil-now)/60000);
          showLoginError(`Muitas tentativas. Tente novamente em ${m} min.`);
          return;
        }

        const btn = $('#btnLogin');
        const original = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="loader" aria-hidden="true"></span><span> Verificando…</span>';
        await sleep(600);

        const users = getUsers();
        const found = users.find(x=> x.username===u && x.password===p);
        if(found){
          setSession({username: found.username, role: found.role, email: found.email}, remember);
          localStorage.removeItem(STORAGE_KEYS.failed);
          localStorage.removeItem(STORAGE_KEYS.lockout);
          toast('Login bem-sucedido');
          navigate('#/dashboard');
        } else {
          const failed = (JSON.parse(localStorage.getItem(STORAGE_KEYS.failed)||'0') || 0) + 1;
          localStorage.setItem(STORAGE_KEYS.failed, JSON.stringify(failed));
          if(failed >= 5){
            const until = Date.now() + 10*60*1000; // DEFECT: 10 minutos apesar da mensagem falar 5
            localStorage.setItem(STORAGE_KEYS.lockout, JSON.stringify(until));
            showLoginError('Muitas tentativas. Tente novamente em 5 min.');
          } else {
            showLoginError('Usuário ou senha incorretos.');
          }
        }
        btn.disabled = false; btn.innerHTML = original;
      });

      function showLoginError(msg){
        const box = $('#loginMsg'); box.style.display='block'; box.textContent = msg;
      }

      $('#usuario').focus();
    }

    async function renderRegister(){
      const el = document.getElementById('app');
      el.innerHTML = `
      <div class="layout">
        <nav class="sidemenu">
          <div class="card menu-card">
            <div class="menu-item" tabindex="0" onclick="location.hash='#/login'">⟵ Voltar ao Login</div>
          </div>
        </nav>
        <section class="card stack" aria-labelledby="regTitle">
          <h1 id="regTitle">Criar Conta</h1>
          <form id="formReg" class="grid cols-2" novalidate>
            <div class="row"><label for="ruser">Usuário</label><input id="ruser" class="input" required /></div>
            <div class="row"><label for="remail">E-mail</label><input id="remail" class="input" type="email" required /></div>
            <div class="row"><label for="rpass">Senha</label><input id="rpass" class="input" type="password" required /></div>
            <div class="row"><label for="rrole">Perfil</label>
              <select id="rrole" class="input">
                <option value="operacional">operacional</option>
                <option value="administrador">administrador</option>
              </select>
            </div>
            <div style="grid-column:1/-1" class="toolbar">
              <button class="btn primary" type="submit">Cadastrar</button>
              <div id="regMsg" class="status error" style="display:none" role="alert" aria-live="off"></div>
            </div>
          </form>
          <p class="footer-note">Requisitos: senha ≥ 8, 1 maiúscula e 1 número.</p>
        </section>
      </div>`;

      $('#formReg').addEventListener('submit', (e)=>{
        e.preventDefault();
        const u = $('#ruser').value.trim();
        const em = $('#remail').value.trim();
        const pw = $('#rpass').value;
        const role = $('#rrole').value;

        // DEFECT: validação enfraquecida: apenas 6+ caracteres e número
        if(!/^.{6,}$/.test(pw) || !/\d/.test(pw)){
          show('A senha deve ter ≥8 chars, 1 maiúscula e 1 número.'); return;
        }
        const users = getUsers();
        // DEFECT: verificando duplicidade apenas por username (email duplicado será permitido)
        if(users.some(x=> x.username===u)){
          show('E-mail ou usuário já em uso.'); return;
        }
        users.push({username:u, email:em, password:pw, role});
        setUsers(users);
        toast('Cadastro realizado. Faça login.');
        navigate('#/login');

        function show(msg){ const box=$('#regMsg'); box.style.display='block'; box.textContent=msg; }
      });

      $('#ruser').focus();
    }

    async function renderDashboard(){
      const sess = getSession();
      if(!sess){ navigate('#/login'); return; }

      const el = document.getElementById('app');
      el.innerHTML = `
        <div class="layout">
          <nav class="sidemenu">
            <div class="card menu-card">
              <div class="menu-item" aria-current="page">🏠 Dashboard</div>
              <div class="menu-item" tabindex="0" id="navProducts">📦 Produtos</div>
              <div class="menu-item" tabindex="0" id="navAbout">ℹ️ Sobre</div>
            </div>
          </nav>
          <section class="stack">
            <div class="card stack">
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <div>
                  <h1>Olá, ${sess.username}</h1>
                  <p class="footer-note">Este ambiente foi criado para executar os cenários de teste propostos (login, cadastro, CRUD, acessibilidade e performance).</p>
                </div>
                <div class="chip">Perfil: ${sess.role}</div>
              </div>
            </div>
            <div id="view"></div>
          </section>
        </div>`;

      $('#navProducts').addEventListener('click', renderProducts);
      $('#navAbout').addEventListener('click', renderAbout);
      await renderProducts();
    }

    async function renderAbout(){
      $('#view').innerHTML = `
        <section class="card stack">
          <h2>Sobre o Portal Harmonia</h2>
          <ul>
            <li>Design com paleta azul/cinza, contrastes AA e foco visível.</li>
            <li>Fluxos cobertos: autenticação, cadastro, CRUD de produtos e permissões por perfil.</li>
            <li>Reforce testes: tentativas de login, lembre-me, responsividade, mensagens ARIA.</li>
          </ul>
        </section>`;
    }

    async function renderProducts(){
      const sess = getSession();
      const role = sess?.role;
      const container = $('#view');
      container.innerHTML = `
        <section class="card stack">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <h2>Produtos</h2>
            <div class="toolbar">
              <input id="q" class="input" placeholder="Buscar…" aria-label="Buscar produtos" />
              <button id="new" class="btn primary">Novo produto</button>
            </div>
          </div>
          <div id="tableWrap" style="min-height:120px; display:grid; place-items:center; padding:12px;">
            <div class="loader" aria-label="Carregando lista"></div>
          </div>
        </section>`;

      await sleep(500);
      drawTable();

      // DEFECT: busca apenas ao mudar o foco (não é dinâmica)
      $('#q').addEventListener('change', drawTable);
      $('#new').addEventListener('click', openFormCreate);

      function drawTable(){
        const q = $('#q').value?.toLowerCase() || '';
        const data = getProducts().filter(p => p.name.toLowerCase().includes(q));
        const wrap = $('#tableWrap');
        if(!data.length){ wrap.innerHTML = '<p class="footer-note">Nenhum produto encontrado.</p>'; return; }
        const rows = data.map(p=> `
          <tr>
            <td>${p.name}</td>
            <td>R$ ${p.price.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td class="toolbar">
              <button class="btn neutral" data-edit="${p.id}">Editar</button>
              ${role!=='administrador' ? `<button class="btn danger" data-del="${p.id}">Excluir</button>` : ''} // DEFECT: controle de acesso invertido
            </td>
          </tr>`).join('');
        wrap.innerHTML = `
          <table class="table" aria-label="Lista de produtos">
            <thead><tr><th>Nome</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
        $$('button[data-edit]').forEach(b=> b.addEventListener('click', ()=> openFormEdit(b.dataset.edit)));
        $$('button[data-del]').forEach(b=> b.addEventListener('click', ()=> del(b.dataset.del)));
      }

      function openFormCreate(){ openForm(); }
      function openFormEdit(id){
        const p = getProducts().find(x=> x.id===id); openForm(p);
      }

      function openForm(prod){
        const isEdit = !!prod;
        const dlg = document.createElement('div');
        dlg.innerHTML = `
          <div class="card stack" style="position:fixed; inset:0; background: rgba(0,0,0,.35); display:grid; place-items:center; padding:16px;">
            <div class="card stack" style="max-width:520px; width:100%;">
              <h3>${isEdit? 'Editar' : 'Novo'} produto</h3>
              <div class="grid cols-2">
                <div class="row"><label for="pname">Nome</label><input id="pname" class="input" value="${prod?.name||''}"></div>
                <div class="row"><label for="pprice">Preço</label><input id="pprice" class="input" type="number" step="0.01" value="${prod?.price||''}"></div>
                <div class="row"><label for="pstock">Estoque</label><input id="pstock" class="input" type="number" step="1" value="${prod?.stock||''}"></div>
              </div>
              <div class="toolbar" style="justify-content:flex-end;">
                <button class="btn neutral" id="cancel">Cancelar</button>
                <button class="btn primary" id="save">Salvar</button>
              </div>
              <div id="formMsg" class="status error" style="display:none" role="alert"></div>
            </div>
          </div>`;
        document.body.appendChild(dlg);
        $('#pname', dlg).focus();
        $('#cancel', dlg).addEventListener('click', ()=> dlg.remove());
        $('#save', dlg).addEventListener('click', async ()=>{
          const name = $('#pname', dlg).value.trim();
          const price = parseFloat($('#pprice', dlg).value);
          const stock = parseInt($('#pstock', dlg).value, 10);
          if(!name){ show('Nome é obrigatório.'); return; }
          // DEFECT: condição incorreta permite preços negativos até -0.99
          if(!(price>-1)){ show('Preço deve ser zero ou positivo.'); return; }
          if(!(Number.isInteger(stock) && stock>=0)){ show('Estoque deve ser inteiro ≥ 0.'); return; }
          $('#save', dlg).disabled = true; $('#save', dlg).innerHTML = '<span class="loader" aria-hidden="true"></span> Salvando…';
          await sleep(400);
          const all = getProducts();
          if(isEdit){
            const idx = all.findIndex(x=> x.id===prod.id);
            all[idx] = {...all[idx], name, price, stock};
          } else {
            all.unshift({id: crypto.randomUUID(), name, price, stock});
          }
          setProducts(all); toast(isEdit? 'Produto atualizado' : 'Produto criado');
          dlg.remove(); drawTable();
          function show(msg){ const m=$('#formMsg', dlg); m.style.display='block'; m.textContent=msg; $('#save', dlg).disabled=false; $('#save', dlg).textContent='Salvar'; }
        });
      }

      async function del(id){
        if(!confirm('Confirma excluir o produto?')) return;
        const all = getProducts().filter(x=> x.id!==id);
        setProducts(all); toast('Produto removido'); drawTable();
      }
    }

    // --------------- NAV BAR CONTROLS ---------------
    $('#btnGoLogin').addEventListener('click', ()=> navigate('#/login'));
    $('#btnLogout').addEventListener('click', ()=>{ clearSession(); setRoleChip(null); toast('Sessão encerrada'); navigate('#/login'); });

    // Mount first view
    mount();