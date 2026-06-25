import { supabase } from '../supabase/client.js';

function isActiveCatalogRow(row) {
  const status = String(row?.status || '').trim().toLowerCase();
  return !status || status === 'active';
}

async function loadTable(table, orderCol = 'name') {
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select('*').order(orderCol);
  if (error) {
    console.warn(`academicCatalog ${table}:`, error.message);
    return [];
  }
  return (data || []).filter(isActiveCatalogRow);
}

export async function loadUniversities() {
  return loadTable('universities', 'name');
}

export async function loadBranches(universityId) {
  if (!supabase) return [];
  let q = supabase.from('branches').select('*').eq('status', 'active').order('name');
  if (universityId) q = q.eq('university_id', universityId);
  const { data, error } = await q;
  if (error) {
    console.warn('academicCatalog branches:', error.message);
    return [];
  }
  return data || [];
}

export async function loadRegulations() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('regulations')
    .select('id, regulation_name, regulation_code, university, status')
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('academicCatalog regulations:', error.message);
    return [];
  }
  return (data || []).filter(isActiveCatalogRow);
}

function fillSelect(selectEl, options, { valueKey = 'id', labelFn } = {}) {
  if (!selectEl) return;
  const current = selectEl.value;
  const first = selectEl.querySelector('option[value=""]')?.outerHTML || '<option value="">Select</option>';
  selectEl.innerHTML =
    first +
    options
      .map((o) => {
        const val = o[valueKey] ?? o;
        const label = labelFn ? labelFn(o) : o.name || o.regulation_name || o.regulation_code || String(val);
        return `<option value="${String(val).replace(/"/g, '&quot;')}">${label}</option>`;
      })
      .join('');
  if (current) selectEl.value = current;
}

export async function hydrateProfileAcademicDropdowns(root = document) {
  const uniSelect = root.getElementById?.('p-university') || document.getElementById('p-university');
  const regSelect = root.getElementById?.('p-regulation') || document.getElementById('p-regulation');
  const branchSelect = root.getElementById?.('p-branch') || document.getElementById('p-branch');

  const [universities, regulations] = await Promise.all([loadUniversities(), loadRegulations()]);

  if (universities.length && uniSelect) {
    fillSelect(uniSelect, universities, {
      valueKey: 'name',
      labelFn: (u) => u.name,
    });
  }

  if (regulations.length && regSelect) {
    fillSelect(regSelect, regulations, {
      valueKey: 'regulation_code',
      labelFn: (r) => r.regulation_code || r.regulation_name,
    });
  }

  const syncBranches = async () => {
    const uniName = uniSelect?.value;
    const uni = universities.find((u) => u.name === uniName);
    const branches = await loadBranches(uni?.id);
    if (branches.length && branchSelect) {
      fillSelect(branchSelect, branches, { valueKey: 'name', labelFn: (b) => b.name });
    }
  };

  if (uniSelect && !uniSelect.dataset.catalogBound) {
    uniSelect.dataset.catalogBound = '1';
    uniSelect.addEventListener('change', syncBranches);
  }
  await syncBranches();
}
