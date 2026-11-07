window.__ModuleLoader__.load({
  id: '@pnpwin/dsh-auto-review-fallback',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'pnpwin.auto-review-fallback';
    const SETTINGS_NS = 'pnpwin-auto-review-fallback';
    const MAX_ROUTES = 8;
    const en = {
      nav: 'Auto review', title: 'Auto review models',
      intro: 'Choose which models review authorization requests. Changes take effect only after Save.',
      warning: 'Review history is sent to each selected provider that is attempted. Smaller models may make less reliable authorization decisions.',
      safety: 'Fallbacks are for unavailable models or transport errors only. A denial or malformed review stops the chain; another model is not asked to overturn it.',
      mode: 'Review routing', session: 'Follow session (default)', chain: 'Custom model chain',
      sessionHint: 'Uses the session model. Normal conversation requests are never rerouted.',
      chainHint: 'First route is primary; remaining routes are tried in order. Normal conversation requests are never rerouted.',
      inactive: 'This chain is stored but inactive while following the session.',
      routes: 'Ordered review routes', primary: 'Primary', fallback: 'Fallback {number}',
      provider: 'Provider', providerId: 'Provider ID (manual entry)', pickProvider: 'Choose a provider…',
      customProvider: 'Manual provider ID', providerHint: 'Connected providers from Settings → Models. The full list is always shown.',
      catalogModel: 'Model catalog', pickModel: 'Choose a model…', customModel: 'Custom / entered model ID',
      model: 'Model ID', modelHint: 'An exact model ID can be entered even when the catalog is unavailable.',
      effort: 'Reasoning effort (optional)', effortHint: 'Leave empty for the adapter default (or its first supported effort when thinking is mandatory); otherwise enter an exact supported effort.',
      up: 'Move route {number} up', down: 'Move route {number} down', remove: 'Remove route {number}',
      add: 'Add route', limit: '{count} / 8 routes', empty: 'No custom routes. Add a primary model to use a custom chain.',
      timeout: 'Attempt timeout (milliseconds)', timeoutHint: 'Whole milliseconds, from 1,000 to 120,000. Default: 20,000.',
      save: 'Save', saving: 'Saving…', saved: 'Routing saved.', unsaved: 'Unsaved changes',
      discard: 'Discard draft', reload: 'Reload settings', reloadDiscard: 'Reload and discard draft', loading: 'Loading settings…',
      retryCatalog: 'Reload catalog', catalogLoading: 'Loading model catalog…',
      catalogFailed: 'Model catalog unavailable. Enter provider and model IDs manually.',
      catalogEmpty: 'No registered providers in the catalog. Enter IDs manually or configure a provider in Models settings.',
      modelCatalogFailed: 'This provider’s model catalog is unavailable. Enter the exact model ID manually.',
      readOnly: 'Settings are read-only for this connection.', missing: 'Auto review settings are unavailable. Install or enable the Host plugin, then reload.',
      badRevision: 'The server did not return a settings revision. Reload before saving.',
      invalidResponse: 'The server returned an invalid settings response.',
      loadFailed: 'Could not load settings. Your draft has been kept.', saveFailed: 'Could not save. Your draft has been kept.',
      conflict: 'Settings changed elsewhere. Your draft has not been overwritten or saved. Reload the current settings before editing again.',
      required: 'Every route needs a nonempty provider ID and model ID.', duplicate: 'Each provider / model pair can appear only once.',
      tooMany: 'Use no more than 8 routes.', needRoute: 'A custom chain needs at least one route.',
      badTimeout: 'Timeout must be a whole number from 1,000 to 120,000 milliseconds.',
    };
    const ru = {
      nav: 'Модели Auto review', title: 'Модели Auto review',
      intro: 'Выберите модели для проверки разрешений. Изменения применяются только после нажатия «Сохранить».',
      warning: 'История проверки отправляется каждому выбранному провайдеру, к которому выполняется обращение. Небольшие модели могут менее надёжно оценивать разрешения.',
      safety: 'Резервные модели используются только при недоступности модели или ошибках связи. Отказ или некорректный ответ останавливает цепочку: другая модель не пересматривает решение.',
      mode: 'Маршрутизация проверки', session: 'Модель сессии (по умолчанию)', chain: 'Своя цепочка моделей',
      sessionHint: 'Используется модель сессии. Обычные запросы диалога не перенаправляются.',
      chainHint: 'Первая модель — основная, остальные пробуются по порядку. Обычные запросы диалога не перенаправляются.',
      inactive: 'Цепочка сохранена, но не используется в режиме модели сессии.',
      routes: 'Порядок моделей проверки', primary: 'Основная', fallback: 'Резервная {number}',
      provider: 'Провайдер', providerId: 'ID провайдера (ручной ввод)', pickProvider: 'Выберите провайдера…',
      customProvider: 'Свой ID провайдера', providerHint: 'Подключённые провайдеры из Settings → Models. Всегда отображается весь список.',
      catalogModel: 'Каталог моделей', pickModel: 'Выберите модель…', customModel: 'Свой / введённый ID модели',
      model: 'ID модели', modelHint: 'Точный ID модели можно ввести, даже если каталог недоступен.',
      effort: 'Уровень рассуждений (необязательно)', effortHint: 'Пустое поле — настройка адаптера или первый поддерживаемый уровень при обязательных рассуждениях. Иначе введите точный поддерживаемый effort.',
      up: 'Переместить маршрут {number} выше', down: 'Переместить маршрут {number} ниже', remove: 'Удалить маршрут {number}',
      add: 'Добавить маршрут', limit: 'Маршрутов: {count} / 8', empty: 'Своих маршрутов нет. Добавьте основную модель, чтобы использовать свою цепочку.',
      timeout: 'Таймаут попытки (миллисекунды)', timeoutHint: 'Целое число от 1 000 до 120 000. По умолчанию: 20 000.',
      save: 'Сохранить', saving: 'Сохранение…', saved: 'Маршрутизация сохранена.', unsaved: 'Есть несохранённые изменения',
      discard: 'Отменить правки', reload: 'Загрузить настройки заново', reloadDiscard: 'Загрузить заново и отменить правки', loading: 'Загрузка настроек…',
      retryCatalog: 'Обновить каталог', catalogLoading: 'Загрузка каталога моделей…',
      catalogFailed: 'Каталог моделей недоступен. Введите ID провайдера и модели вручную.',
      catalogEmpty: 'В каталоге нет зарегистрированных провайдеров. Введите ID вручную или настройте провайдера в разделе «Модели».',
      modelCatalogFailed: 'Каталог этого провайдера недоступен. Введите точный ID модели вручную.',
      readOnly: 'Для этого подключения настройки доступны только для чтения.', missing: 'Настройки Auto review недоступны. Установите или включите серверный плагин, затем загрузите настройки заново.',
      badRevision: 'Сервер не вернул ревизию настроек. Загрузите их заново перед сохранением.',
      invalidResponse: 'Сервер вернул некорректный ответ с настройками.',
      loadFailed: 'Не удалось загрузить настройки. Ваши правки сохранены в форме.', saveFailed: 'Не удалось сохранить настройки. Ваши правки сохранены в форме.',
      conflict: 'Настройки изменились в другом месте. Ваши правки не перезаписаны и не сохранены. Загрузите актуальные настройки перед дальнейшим редактированием.',
      required: 'Для каждого маршрута нужны непустые ID провайдера и модели.', duplicate: 'Каждая пара провайдер / модель может встречаться только один раз.',
      tooMany: 'Можно указать не более 8 маршрутов.', needRoute: 'Для своей цепочки нужен хотя бы один маршрут.',
      badTimeout: 'Таймаут должен быть целым числом от 1 000 до 120 000 миллисекунд.',
    };
    const css = `
.larr-section{max-width:720px;display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.larr-section h2{margin:0;font-size:16px;line-height:24px;font-weight:500}.larr-section p{margin:0;overflow-wrap:anywhere}
.larr-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.larr-warn{color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:18px}
.larr-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}.larr-success{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}
.larr-group{border:0;padding:0;margin:0;min-width:0;display:flex;flex-direction:column;gap:8px}.larr-group>legend{padding:0;margin-bottom:8px;font-weight:500}
.larr-radio{display:flex;align-items:center;gap:8px}.larr-radio input{accent-color:var(--dsw-alias-brand-primary)}
.larr-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}.larr-card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:12px;min-width:0}
.larr-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.larr-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.larr-row .larr-actions{margin-left:auto}.larr-name{font-size:14px;font-weight:500}
.larr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.larr-field{display:flex;flex-direction:column;gap:4px;min-width:0}.larr-wide{grid-column:1/-1}
.larr-input{box-sizing:border-box;width:100%;min-height:36px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;min-width:0}
.larr-input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}.larr-button{box-sizing:border-box;min-height:36px;padding:6px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}
.larr-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:500}.larr-button:disabled,.larr-input:disabled{opacity:.55;cursor:default}.larr-button:focus-visible,.larr-input:focus-visible,.larr-radio input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.larr-section fieldset:disabled{opacity:.7}
@media(max-width:560px){.larr-grid{grid-template-columns:minmax(0,1fr)}.larr-row .larr-actions{margin-left:0}.larr-button{min-height:40px}}
`;
    let nextKey = 0;
    function draftOf(routing) {
      const value = routing && typeof routing === 'object' ? routing : {};
      return {
        mode: value.mode === 'chain' ? 'chain' : 'session',
        timeoutMs: String(value.timeoutMs == null ? 20000 : value.timeoutMs),
        routes: (Array.isArray(value.routes) ? value.routes : []).map(route => ({
          key: ++nextKey,
          provider: typeof route.provider === 'string' ? route.provider : '',
          model: typeof route.model === 'string' ? route.model : '',
          reasoningEffort: typeof route.reasoningEffort === 'string' ? route.reasoningEffort : '',
        })),
      };
    }
    function wireOf(draft) {
      return {
        mode: draft.mode,
        routes: draft.routes.map(route => ({ provider: route.provider.trim(), model: route.model.trim(), reasoningEffort: route.reasoningEffort.trim() })),
        timeoutMs: Number(draft.timeoutMs),
      };
    }
    function fingerprint(draft) {
      return JSON.stringify({ ...draft, routes: draft.routes.map(({ key, ...route }) => route) });
    }
    function validation(draft) {
      if (!/^\d+$/.test(draft.timeoutMs) || !Number.isInteger(Number(draft.timeoutMs)) || Number(draft.timeoutMs) < 1000 || Number(draft.timeoutMs) > 120000) return 'badTimeout';
      if (draft.routes.length > MAX_ROUTES) return 'tooMany';
      if (draft.mode === 'chain' && !draft.routes.length) return 'needRoute';
      const seen = new Set();
      for (const route of draft.routes) {
        if (!route.provider.trim() || !route.model.trim()) return 'required';
        const key = JSON.stringify([route.provider.trim(), route.model.trim()]);
        if (seen.has(key)) return 'duplicate';
        seen.add(key);
      }
      return null;
    }
    // Settings → Models uses this same registered/directory/settings join.
    // This pure projection never changes settings or copies credentials.
    function joinSettingsModels(registered, directory, described, modelCatalog) {
      if (!Array.isArray(registered) || !Array.isArray(directory) || !Array.isArray(described?.namespaces)) {
        throw new Error('Invalid Models settings directory');
      }
      const namespaces = new Map(described.namespaces.map(view => [view.ns, view]));
      const active = new Map(registered.map(provider => [provider.id, provider]));
      const groups = new Map((modelCatalog?.groups ?? []).map(group => [group.id, group]));
      const failed = new Set((modelCatalog?.failures ?? []).map(entry => entry.id));
      const rows = new Map();
      function profileFor(entry) {
        const view = namespaces.get(entry.settingsNs);
        if (!view) return undefined;
        let value = view.value;
        for (const segment of entry.settingsPath ?? []) {
          if (!value || typeof value !== 'object' || !Object.hasOwn(value, segment)) return undefined;
          value = value[segment];
        }
        return value;
      }
      function append(id, name, profile, available, declaredError) {
        if (typeof id !== 'string' || !id.trim() || rows.has(id)) return;
        const group = groups.get(id);
        const candidates = group?.models?.length ? group.models : Array.isArray(profile?.models) ? profile.models : [];
        const unique = new Map();
        for (const model of candidates) {
          if (typeof model?.id !== 'string' || !model.id.trim() || unique.has(model.id)) continue;
          unique.set(model.id, { id: model.id, name: typeof model.name === 'string' && model.name.trim() ? model.name : model.id });
        }
        const displayName = typeof profile?.displayName === 'string' && profile.displayName.trim()
          ? profile.displayName : typeof name === 'string' && name.trim() ? name : group?.name ?? id;
        rows.set(id, { id, name: displayName, models: [...unique.values()],
          error: declaredError || failed.has(id) || !available ? 'Model catalog unavailable' : null });
      }
      for (const entry of directory) {
        const profile = profileFor(entry);
        const available = active.has(entry.provider);
        // Installed-but-unconfigured provider templates are not user connections.
        if (!available && profile === undefined) continue;
        append(entry.provider, entry.displayName, profile, available, entry.error);
      }
      for (const provider of registered) append(provider.id, provider.name, undefined, true, false);
      const rank = id => id === 'deepseek-account' ? 0 : id === 'deepseek-official' ? 1 : 2;
      return [...rows.values()].sort((a, b) => rank(a.id) - rank(b.id));
    }
    // End pure Settings catalog projection.
    function remoteValue(result) {
      if (result && result.ok === true) return result.value;
      const error = new Error(result && result.error && result.error.message || '');
      error.code = result && result.error && result.error.code;
      throw error;
    }
    function messageOf(error) { return error && error.message ? error.message : String(error); }
    return {
      inject: ['slots', 'locale', 'remote', 'remote.settings', 'remote.llm', 'remote.session'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', en), 'auto-review-router: English copy');
        ctx.effect(() => ctx.locale.register(NS, 'ru', ru), 'auto-review-router: Russian copy');
        const t = ctx.locale.bind(NS);
        const subscribeLocale = listener => ctx.locale.subscribe(listener);
        const localeSnapshot = () => ctx.locale.getSnapshot();
        function SettingsSection() {
          React.useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
          const id = React.useId();
          const alive = React.useRef(true);
          const operation = React.useRef(false);
          const [draft, setDraft] = React.useState(() => draftOf(null));
          const [savedDraft, setSavedDraft] = React.useState(null);
          const [revision, setRevision] = React.useState(null);
          const [writable, setWritable] = React.useState(false);
          const [busy, setBusy] = React.useState('loading');
          const [failure, setFailure] = React.useState(null);
          const [conflict, setConflict] = React.useState(false);
          const [savedNotice, setSavedNotice] = React.useState(false);
          const [catalog, setCatalog] = React.useState([]);
          const [catalogState, setCatalogState] = React.useState('loading');
          const [catalogVersion, setCatalogVersion] = React.useState(0);
          const dirty = savedDraft !== null && fingerprint(draft) !== fingerprint(savedDraft);
          const invalid = validation(draft);
          async function load() {
            if (operation.current) return;
            operation.current = true;
            setBusy('loading');
            setFailure(null);
            setSavedNotice(false);
            try {
              const described = remoteValue(await ctx.remote.settings.describe());
              if (!described || !Array.isArray(described.namespaces)) throw new Error(t('invalidResponse'));
              const view = described.namespaces.find(item => item.ns === SETTINGS_NS);
              if (!view) throw new Error(t('missing'));
              if (!Number.isSafeInteger(view.revision) || view.revision < 0) throw new Error(t('badRevision'));
              const next = draftOf(view.value && view.value.routing);
              if (!alive.current) return;
              setDraft(next);
              setSavedDraft(next);
              setRevision(view.revision);
              setWritable(described.writable === true);
              setConflict(false);
            } catch (error) {
              if (alive.current) setFailure({ key: 'loadFailed', detail: messageOf(error) });
            } finally {
              operation.current = false;
              if (alive.current) setBusy(null);
            }
          }
          React.useEffect(() => {
            alive.current = true;
            load();
            return () => { alive.current = false; };
          }, []);
          React.useEffect(() => {
            const controller = new AbortController();
            setCatalogState('loading');
            const timer = setTimeout(() => {
              setCatalogState('error');
              controller.abort();
            }, 20000);
            Promise.all([
              ctx.remote.llm.listProviders().then(remoteValue),
              ctx.remote.llm.listConfigurableProviders().then(remoteValue),
              ctx.remote.settings.describe().then(remoteValue),
              // A failed model catalog must not hide configured providers. Keep
              // saved model IDs and allow manual entry, just like Models settings.
              ctx.remote.session.modelCatalog().then(remoteValue).catch(() => ({ groups: [], failures: [] })),
            ])
              .then(([registered, directory, described, models]) => {
                const providers = joinSettingsModels(registered, directory, described, models);
                if (controller.signal.aborted) return;
                setCatalog(providers);
                setCatalogState('ready');
              })
              .catch(() => { if (!controller.signal.aborted) setCatalogState('error'); })
              .finally(() => clearTimeout(timer));
            return () => { clearTimeout(timer); controller.abort(); };
          }, [catalogVersion]);
          function edit(transform) {
            if (operation.current || !writable || conflict) return;
            setDraft(transform);
            setSavedNotice(false);
            setFailure(null);
          }
          function updateRoute(key, patch) {
            edit(previous => ({ ...previous, routes: previous.routes.map(route => route.key === key ? { ...route, ...patch } : route) }));
          }
          function moveRoute(index, offset) {
            edit(previous => {
              const routes = previous.routes.slice();
              const target = index + offset;
              if (target < 0 || target >= routes.length) return previous;
              [routes[index], routes[target]] = [routes[target], routes[index]];
              return { ...previous, routes };
            });
          }
          async function save(event) {
            event.preventDefault();
            if (operation.current || !writable || conflict || !dirty || invalid || !Number.isSafeInteger(revision)) return;
            operation.current = true;
            setBusy('saving');
            setFailure(null);
            setSavedNotice(false);
            try {
              // Never retry unconditionally: this setting controls authorization review.
              const view = remoteValue(await ctx.remote.settings.update(SETTINGS_NS, { routing: wireOf(draft) }, revision));
              if (!view || view.ns !== SETTINGS_NS || !Number.isSafeInteger(view.revision) || view.revision < 0 || !view.value || !view.value.routing) throw new Error(t('invalidResponse'));
              if (!alive.current) return;
              const next = draftOf(view.value.routing);
              setDraft(next);
              setSavedDraft(next);
              setRevision(view.revision);
              setSavedNotice(true);
            } catch (error) {
              if (!alive.current) return;
              if (error.code === 'settings/conflict') setConflict(true);
              setFailure({ key: error.code === 'settings/conflict' ? 'conflict' : 'saveFailed', detail: messageOf(error) });
            } finally {
              operation.current = false;
              if (alive.current) setBusy(null);
            }
          }
          const locked = Boolean(busy) || !writable || conflict;
          const hint = (text, extra) => h('p', { className: 'larr-hint', ...extra }, text);
          const button = (text, onClick, disabled, extra) => h('button', { type: 'button', className: 'larr-button', onClick, disabled, ...extra }, text);
          function field(label, control, help, wide) {
            return h('label', { className: 'larr-field' + (wide ? ' larr-wide' : '') }, h('span', null, label), control, help ? h('span', { className: 'larr-hint' }, help) : null);
          }
          return h('form', { className: 'larr-section', onSubmit: save, 'aria-busy': Boolean(busy) },
            h('style', null, css),
            h('h2', null, t('title')),
            h('p', null, t('intro')),
            h('p', { className: 'larr-warn' }, t('warning')),
            hint(t('safety')),
            busy === 'loading' ? h('p', { role: 'status', className: 'larr-hint' }, t('loading')) : null,
            savedDraft !== null && !writable ? hint(t('readOnly')) : null,
            failure ? h('div', { role: 'alert', className: 'larr-error' }, h('p', null, t(failure.key)), failure.detail ? h('p', null, failure.detail) : null) : null,
            h('fieldset', { className: 'larr-group', disabled: locked },
              h('legend', null, t('mode')),
              ...['session', 'chain'].map(mode => h('label', { className: 'larr-radio', key: mode },
                h('input', { type: 'radio', name: id + '-mode', value: mode, checked: draft.mode === mode, onChange: () => edit(previous => ({ ...previous, mode })) }), t(mode))),
              hint(t(draft.mode === 'session' ? 'sessionHint' : 'chainHint'))),
            h('div', { className: 'larr-row' }, h('span', { className: 'larr-name' }, t('routes')), hint(t('limit', { count: draft.routes.length }))),
            draft.mode === 'session' ? hint(t('inactive')) : null,
            h('div', { className: 'larr-row' },
              hint(t(catalogState === 'loading' ? 'catalogLoading' : catalogState === 'error' ? 'catalogFailed' : catalog.length ? 'providerHint' : 'catalogEmpty')),
              button(t('retryCatalog'), () => setCatalogVersion(value => value + 1), catalogState === 'loading')),
            !draft.routes.length ? hint(t('empty')) : null,
            h('ol', { className: 'larr-list', 'aria-label': t('routes') }, ...draft.routes.map((route, index) => {
              const provider = catalog.find(item => item.id === route.provider.trim());
              const models = provider ? provider.models : [];
              const knownModel = models.some(model => model.id === route.model);
              const duplicate = draft.routes.some((other, at) => at !== index && other.provider.trim() === route.provider.trim() && other.model.trim() === route.model.trim());
              return h('li', { className: 'larr-card', key: route.key },
                h('div', { className: 'larr-row' },
                  h('span', { className: 'larr-name' }, index === 0 ? t('primary') : t('fallback', { number: index })),
                  h('div', { className: 'larr-actions' },
                    button('↑', () => moveRoute(index, -1), locked || index === 0, { 'aria-label': t('up', { number: index + 1 }), title: t('up', { number: index + 1 }) }),
                    button('↓', () => moveRoute(index, 1), locked || index === draft.routes.length - 1, { 'aria-label': t('down', { number: index + 1 }), title: t('down', { number: index + 1 }) }),
                    button('×', () => edit(previous => ({ ...previous, routes: previous.routes.filter(item => item.key !== route.key) })), locked, { 'aria-label': t('remove', { number: index + 1 }), title: t('remove', { number: index + 1 }) }))),
                h('div', { className: 'larr-grid' },
                  field(t('provider'), h('select', { className: 'larr-input', disabled: locked || !catalog.length, value: provider ? provider.id : '', 'aria-invalid': !route.provider.trim() || duplicate,
                    onChange: event => updateRoute(route.key, { provider: event.target.value, model: '', reasoningEffort: '' }) },
                    h('option', { value: '' }, t(route.provider && !provider ? 'customProvider' : 'pickProvider')),
                    ...catalog.map(item => h('option', { key: item.id, value: item.id }, item.name + ' — ' + item.id)))),
                  field(t('providerId'), h('input', { className: 'larr-input', type: 'text', autoComplete: 'off', spellCheck: false, value: route.provider, disabled: locked, 'aria-invalid': !route.provider.trim() || duplicate,
                    onChange: event => updateRoute(route.key, { provider: event.target.value, model: '', reasoningEffort: '' }) })),
                  field(t('catalogModel'), h('select', { className: 'larr-input', disabled: locked || !models.length, value: knownModel ? route.model : '', onChange: event => { if (event.target.value) updateRoute(route.key, { model: event.target.value }); } },
                    h('option', { value: '' }, t(route.model ? 'customModel' : 'pickModel')),
                    ...models.map(model => h('option', { key: model.id, value: model.id }, model.name + (model.name === model.id ? '' : ' — ' + model.id))))),
                  field(t('model'), h('input', { className: 'larr-input', type: 'text', autoComplete: 'off', spellCheck: false, value: route.model, disabled: locked, 'aria-invalid': !route.model.trim() || duplicate, onChange: event => updateRoute(route.key, { model: event.target.value }) }), t('modelHint'), true),
                  field(t('effort'), h('input', { className: 'larr-input', type: 'text', autoComplete: 'off', spellCheck: false, value: route.reasoningEffort, disabled: locked, onChange: event => updateRoute(route.key, { reasoningEffort: event.target.value }) }), t('effortHint'), true)),
                provider && provider.error ? hint(t('modelCatalogFailed')) : null);
            })),
            h('div', { className: 'larr-actions' }, button(t('add'), () => edit(previous => ({ ...previous, routes: previous.routes.length < MAX_ROUTES ? [...previous.routes, { key: ++nextKey, provider: '', model: '', reasoningEffort: '' }] : previous.routes })), locked || draft.routes.length >= MAX_ROUTES)),
            field(t('timeout'), h('input', { className: 'larr-input', type: 'number', min: 1000, max: 120000, step: 1, inputMode: 'numeric', value: draft.timeoutMs, disabled: locked, 'aria-invalid': invalid === 'badTimeout', onChange: event => edit(previous => ({ ...previous, timeoutMs: event.target.value })) }), t('timeoutHint')),
            savedDraft !== null && invalid ? h('p', { className: 'larr-error', role: 'status' }, t(invalid)) : null,
            savedNotice ? h('p', { className: 'larr-success', role: 'status' }, t('saved')) : dirty ? hint(t('unsaved'), { role: 'status' }) : null,
            h('div', { className: 'larr-actions' },
              h('button', { type: 'submit', className: 'larr-button larr-primary', disabled: locked || !dirty || Boolean(invalid) || !Number.isSafeInteger(revision) }, t(busy === 'saving' ? 'saving' : 'save')),
              button(t('discard'), () => { if (savedDraft && !operation.current) { setDraft(savedDraft); setFailure(null); setSavedNotice(false); } }, Boolean(busy) || !dirty || conflict),
              button(t(dirty ? 'reloadDiscard' : 'reload'), load, Boolean(busy))));
        }
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'pnpwin-auto-review-fallback', order: 25,
          label: () => t('nav'), locale: NS,
        }, SettingsSection));
      },
    };
  },
});
