// Generate Excel import templates for ATS platform
// Run: node generate-excel-templates.js

const ExcelJS = require('/tmp/xlsx-gen/node_modules/exceljs');
const path    = require('path');
const fs      = require('fs');

const OUT_DIR = path.join(__dirname, 'csv-templates');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Style helpers ────────────────────────────────────────────────────────────
const ORANGE  = 'FFE88E2E'; // required header
const GREY    = 'FFE2E8F0'; // optional header
const WHITE   = 'FFFFFFFF';
const DARK    = 'FF0F172A';
const LIGHT_ORANGE = 'FFFFF7ED';

function styleHeader(cell, required) {
  cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: required ? ORANGE : GREY } };
  cell.font   = { bold: true, color: { argb: required ? WHITE : DARK }, size: 11 };
  cell.border = {
    bottom: { style: 'medium', color: { argb: ORANGE } },
    right:  { style: 'thin',   color: { argb: 'FFD1D5DB' } },
  };
  cell.alignment = { vertical: 'middle', wrapText: true };
}

function styleDataCell(cell) {
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ORANGE } };
  cell.font      = { size: 10 };
  cell.border    = { bottom: { style: 'dotted', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  cell.alignment = { vertical: 'middle' };
}

function addDropdown(ws, col, firstRow, lastRow, formula) {
  for (let r = firstRow; r <= lastRow; r++) {
    ws.getCell(r, col).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: 'Invalid value',
      error: 'Please choose from the dropdown list.',
    };
  }
}

function addInstructions(wb, rows) {
  const ws = wb.addWorksheet('📋 Instructions', { tabColor: { argb: 'FFFF9800' } });
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 55;
  ws.getColumn(3).width = 20;

  const title = ws.getCell('A1');
  title.value = '📋 How to fill in this template';
  title.font  = { bold: true, size: 14, color: { argb: DARK } };
  ws.mergeCells('A1:C1');
  ws.getRow(1).height = 28;

  const sub = ws.getCell('A2');
  sub.value  = 'Fill in the DATA sheet. Do NOT rename or delete any column headers.';
  sub.font   = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
  ws.mergeCells('A2:C2');

  const legend1 = ws.getCell('A3');
  legend1.value = '🟠 Orange header = REQUIRED field';
  legend1.font  = { bold: true, color: { argb: DARK }, size: 10 };
  ws.mergeCells('A3:C3');

  const legend2 = ws.getCell('A4');
  legend2.value = '⬜ Grey header = optional field (leave blank if not known)';
  legend2.font  = { color: { argb: 'FF64748B' }, size: 10 };
  ws.mergeCells('A4:C4');

  ws.addRow([]);

  const hdrRow = ws.addRow(['Column Name', 'Description', 'Example / Allowed Values']);
  hdrRow.eachCell(c => {
    c.font   = { bold: true, color: { argb: WHITE } };
    c.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    c.border = { bottom: { style: 'medium', color: { argb: ORANGE } } };
  });

  rows.forEach(([col, desc, example, req]) => {
    const r = ws.addRow([col, desc, example]);
    if (req) r.getCell(1).font = { bold: true, color: { argb: 'FFC05621' } };
    r.getCell(2).font      = { size: 10 };
    r.getCell(3).font      = { size: 9, italic: true, color: { argb: 'FF475569' } };
    r.height               = 20;
    r.getCell(1).border    = { right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    r.getCell(2).border    = { right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
  });

  ws.views = [{ state: 'frozen', ySplit: 6 }];
}

// ─── 1. CANDIDATES ────────────────────────────────────────────────────────────
async function makeCandidates() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkVision ATS';
  wb.title   = 'Candidates Import Template';

  const ws = wb.addWorksheet('DATA', { tabColor: { argb: 'FF2563EB' } });

  // columns: [header, width, required]
  const cols = [
    ['first_name',          18, true],
    ['last_name',           18, true],
    ['email',               28, false],
    ['phone',               16, true],
    ['provider_name',       24, true],
    ['suburb',              16, false],
    ['address_line1',       28, false],
    ['address_line2',       18, false],
    ['state',               10, false],
    ['postcode',            12, false],
    ['benchmark_hours',     18, true],
    ['availability',        16, false],
    ['work_status',         16, false],
    ['wage_subsidy',        16, false],
    ['wage_subsidy_amount', 20, false],
    ['interested_job',      22, false],
    ['car',                 10, false],
    ['police_check',        14, false],
    ['wwc',                 10, false],
    ['transport_type',      16, false],
    ['industry_preference', 28, false],
    ['training_start_date', 20, false],
    ['training_end_date',   18, false],
    ['date_referred',       16, false],
    ['notes',               30, false],
    ['comments',            30, false],
    ['linkedin',            28, false],
  ];

  cols.forEach(([h, w, req], i) => {
    ws.getColumn(i + 1).width = w;
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    styleHeader(cell, req);
  });
  ws.getRow(1).height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Sample rows
  const samples = [
    ['John','Smith','john.smith@email.com','0412345678','Workforce Connect','Parramatta','14 Park Road','','NSW','2150',38,'Full Time','job_seeking','yes',500,'Warehouse Operator','yes','yes','no','car','Warehouse,Logistics','2026-01-10','2026-03-10','2026-01-05','Looking for day shifts','Good candidate',''],
    ['Mary','Jones','mary.jones@email.com','0423456789','TalentBridge Group','Footscray','7 Crown Street','','VIC','3011',30,'Part Time','job_seeking','no','','Retail Assistant','no','no','no','public_transport','Retail','','','2026-02-01','Available weekends','',''],
    ['Peter','Williams','','0434567890','CareerPath Services','Fortitude Valley','18 Roma Street','','QLD','4006',25,'Casual','inactive','yes',250,'Hospitality','no','no','no','both','Hospitality,Retail','','','2026-01-15','Prefers weekends','','https://linkedin.com/in/peter'],
  ];
  samples.forEach(row => {
    const r = ws.addRow(row);
    r.eachCell(c => styleDataCell(c));
  });

  // Dropdowns
  addDropdown(ws, 13, 2, 200, '"job_seeking,employed,placed,inactive"');
  addDropdown(ws, 14, 2, 200, '"yes,no"');
  addDropdown(ws, 17, 2, 200, '"yes,no"');
  addDropdown(ws, 18, 2, 200, '"yes,no"');
  addDropdown(ws, 19, 2, 200, '"yes,no"');
  addDropdown(ws, 20, 2, 200, '"car,public_transport,both,none"');

  addInstructions(wb, [
    ['first_name',          'Candidate first name', 'John', true],
    ['last_name',           'Candidate last name', 'Smith', true],
    ['email',               'Email address (must be unique)', 'john@email.com', false],
    ['phone',               'Mobile phone number', '0412345678', true],
    ['provider_name',       'Exact provider name as it exists in the system', 'Workforce Connect', true],
    ['suburb',              'Suburb of residence', 'Parramatta', false],
    ['address_line1',       'Street address line 1', '14 Park Road', false],
    ['address_line2',       'Street address line 2 (unit, apt, etc.)', 'Unit 2', false],
    ['state',               'State abbreviation', 'NSW / VIC / QLD / WA / SA / TAS / ACT / NT', false],
    ['postcode',            '4-digit postcode', '2150', false],
    ['benchmark_hours',     'Weekly hours target (number)', '38', true],
    ['availability',        'Availability description', 'Full Time / Part Time / Casual', false],
    ['work_status',         'Current work status — choose from dropdown', 'job_seeking / employed / placed / inactive', false],
    ['wage_subsidy',        'Is wage subsidy applicable?', 'yes / no', false],
    ['wage_subsidy_amount', 'Wage subsidy dollar amount (number)', '500', false],
    ['interested_job',      'Type of job candidate is interested in', 'Warehouse Operator', false],
    ['car',                 'Does candidate have a car?', 'yes / no', false],
    ['police_check',        'Police check status', 'yes / no', false],
    ['wwc',                 'Working With Children check', 'yes / no', false],
    ['transport_type',      'Transport method', 'car / public_transport / both / none', false],
    ['industry_preference', 'Comma-separated list of industries', 'Warehouse,Retail,Hospitality', false],
    ['training_start_date', 'Training start date (YYYY-MM-DD)', '2026-01-10', false],
    ['training_end_date',   'Training end date (YYYY-MM-DD)', '2026-03-10', false],
    ['date_referred',       'Date candidate was referred (YYYY-MM-DD)', '2026-01-05', false],
    ['notes',               'Internal staff notes', 'Looking for morning shifts', false],
    ['comments',            'Additional comments', 'Good candidate', false],
    ['linkedin',            'LinkedIn profile URL', 'https://linkedin.com/in/...', false],
  ]);

  await wb.xlsx.writeFile(path.join(OUT_DIR, 'candidates_import_template.xlsx'));
  console.log('✅ candidates_import_template.xlsx');
}

// ─── 2. EMPLOYERS ─────────────────────────────────────────────────────────────
async function makeEmployers() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkVision ATS';
  wb.title   = 'Employers Import Template';

  const ws = wb.addWorksheet('DATA', { tabColor: { argb: 'FF16A34A' } });

  const cols = [
    ['name',          30, true],
    ['industry',      20, false],
    ['contact_name',  22, false],
    ['contact_email', 28, false],
    ['contact_phone', 18, false],
    ['address',       40, false],
    ['website',       30, false],
    ['description',   40, false],
  ];

  cols.forEach(([h, w, req], i) => {
    ws.getColumn(i + 1).width = w;
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    styleHeader(cell, req);
  });
  ws.getRow(1).height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const samples = [
    ['Acme Manufacturing','Manufacturing','Tom Richards','tom@acmemfg.com.au','02 8000 1001','100 Industrial Ave, Parramatta NSW 2150','https://acmemfg.com.au','Leading manufacturer of industrial equipment'],
    ['Metro Retail Group','Retail','Sarah Bloom','sarah@metroretail.com.au','03 8000 1002','220 Bourke St, Melbourne VIC 3000','https://metroretail.com.au','Major retail group operating across Victoria'],
    ['Greenfield Logistics','Logistics','David Chen','david@greenfieldlog.com.au','07 8000 1003','5 Port Rd, Brisbane QLD 4000','','Freight and warehousing services'],
  ];
  samples.forEach(row => {
    const r = ws.addRow(row);
    r.eachCell(c => styleDataCell(c));
  });

  addInstructions(wb, [
    ['name',          'Employer / company name (must be unique)', 'Acme Manufacturing', true],
    ['industry',      'Industry sector', 'Manufacturing / Retail / Logistics / Healthcare', false],
    ['contact_name',  'Primary contact person name', 'Tom Richards', false],
    ['contact_email', 'Primary contact email', 'tom@company.com.au', false],
    ['contact_phone', 'Primary contact phone', '02 8000 1001', false],
    ['address',       'Full street address including suburb, state and postcode', '100 Industrial Ave, Parramatta NSW 2150', false],
    ['website',       'Company website URL', 'https://company.com.au', false],
    ['description',   'Brief description of the company', 'Leading manufacturer...', false],
  ]);

  await wb.xlsx.writeFile(path.join(OUT_DIR, 'employers_import_template.xlsx'));
  console.log('✅ employers_import_template.xlsx');
}

// ─── 3. PLACEMENTS ────────────────────────────────────────────────────────────
async function makePlacements() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkVision ATS';
  wb.title   = 'Placements Import Template';

  const ws = wb.addWorksheet('DATA', { tabColor: { argb: 'FF9333EA' } });

  const cols = [
    ['candidate_sr_or_name',  26, true],
    ['job_title',             26, true],
    ['employer_name',         26, true],
    ['start_date',            16, true],
    ['end_date',              14, false],
    ['employment_status',     20, false],
    ['termination_reason',    22, false],
    ['notes',                 34, false],
    ['wagesub_status',        18, false],
    ['wagesub_4wk_paid_at',   20, false],
    ['wagesub_13wk_paid_at',  22, false],
    ['wagesub_26wk_paid_at',  22, false],
    ['wagesub_notes',         28, false],
    ['confirmed_by_employer', 22, false],
  ];

  cols.forEach(([h, w, req], i) => {
    ws.getColumn(i + 1).width = w;
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    styleHeader(cell, req);
  });
  ws.getRow(1).height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const samples = [
    ['JS-001','Warehouse Operator','Acme Manufacturing','2026-01-15','','active','','Settled in well','approved','2026-02-12','','','Follow up in 13 weeks','yes'],
    ['JS-002','Retail Assistant','Metro Retail Group','2026-02-01','2026-08-01','completed','Contract ended','Contract completed','paid_13wk','2026-03-01','2026-05-01','','Claim submitted','yes'],
    ['Mary Jones','Forklift Driver','Greenfield Logistics','2026-03-10','','active','','','pending','','','','Still in first month','no'],
  ];
  samples.forEach(row => {
    const r = ws.addRow(row);
    r.eachCell(c => styleDataCell(c));
  });

  addDropdown(ws, 6,  2, 200, '"active,completed,terminated,on_leave"');
  addDropdown(ws, 9,  2, 200, '"pending,approved,paid_4wk,paid_13wk,paid_26wk,not_applicable"');
  addDropdown(ws, 14, 2, 200, '"yes,no"');

  addInstructions(wb, [
    ['candidate_sr_or_name',  'Candidate SR number (e.g. JS-001) OR full name', 'JS-001 or Mary Jones', true],
    ['job_title',             'Exact job/vacancy title as it exists in the system', 'Warehouse Operator', true],
    ['employer_name',         'Exact employer name as it exists in the system', 'Acme Manufacturing', true],
    ['start_date',            'Placement start date (YYYY-MM-DD)', '2026-01-15', true],
    ['end_date',              'Placement end date if completed (YYYY-MM-DD)', '2026-08-01', false],
    ['employment_status',     'Current employment status — choose from dropdown', 'active / completed / terminated / on_leave', false],
    ['termination_reason',    'Reason for termination if applicable', 'Voluntary resignation', false],
    ['notes',                 'Internal notes about the placement', 'Settled in well', false],
    ['wagesub_status',        'Wage subsidy claim status — choose from dropdown', 'pending / approved / paid_4wk / paid_13wk / paid_26wk', false],
    ['wagesub_4wk_paid_at',   'Date 4-week wage subsidy was paid (YYYY-MM-DD)', '2026-02-12', false],
    ['wagesub_13wk_paid_at',  'Date 13-week wage subsidy was paid (YYYY-MM-DD)', '2026-05-01', false],
    ['wagesub_26wk_paid_at',  'Date 26-week wage subsidy was paid (YYYY-MM-DD)', '2026-08-01', false],
    ['wagesub_notes',         'Notes about the wage subsidy claim', 'Claim submitted to DES', false],
    ['confirmed_by_employer', 'Has employer confirmed placement?', 'yes / no', false],
  ]);

  await wb.xlsx.writeFile(path.join(OUT_DIR, 'placements_import_template.xlsx'));
  console.log('✅ placements_import_template.xlsx');
}

// ─── 4. TRAINING PROVIDERS ────────────────────────────────────────────────────
async function makeProviders() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkVision ATS';
  wb.title   = 'Training Providers Import Template';

  const ws = wb.addWorksheet('DATA', { tabColor: { argb: 'FFEA580C' } });

  const cols = [
    ['name',         30, true],
    ['contact_name', 22, false],
    ['email',        28, false],
    ['phone',        16, false],
    ['address',      40, false],
  ];

  cols.forEach(([h, w, req], i) => {
    ws.getColumn(i + 1).width = w;
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    styleHeader(cell, req);
  });
  ws.getRow(1).height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const samples = [
    ['Workforce Connect','Jane Harper','jane@workforceconnect.com.au','02 9000 0001','12 Bridge St, Sydney NSW 2000'],
    ['TalentBridge Group','Mark Sullivan','mark@talentbridge.com.au','03 9000 0002','45 Collins St, Melbourne VIC 3000'],
    ['CareerPath Services','Lisa Nguyen','lisa@careerpathservices.com.au','07 9000 0003','88 Queen St, Brisbane QLD 4000'],
    ['MAX Employment','Rachel Turner','rachel@maxemployment.com.au','02 8765 0001','55 Pitt Street, Sydney NSW 2000'],
  ];
  samples.forEach(row => {
    const r = ws.addRow(row);
    r.eachCell(c => styleDataCell(c));
  });

  addInstructions(wb, [
    ['name',         'Provider / organisation name (must be unique)', 'Workforce Connect', true],
    ['contact_name', 'Primary contact person name', 'Jane Harper', false],
    ['email',        'Provider contact email', 'jane@provider.com.au', false],
    ['phone',        'Provider contact phone', '02 9000 0001', false],
    ['address',      'Full street address including suburb, state and postcode', '12 Bridge St, Sydney NSW 2000', false],
  ]);

  await wb.xlsx.writeFile(path.join(OUT_DIR, 'training_providers_import_template.xlsx'));
  console.log('✅ training_providers_import_template.xlsx');
}

// ─── 5. VACANCIES ─────────────────────────────────────────────────────────────
async function makeVacancies() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkVision ATS';
  wb.title   = 'Vacancies Import Template';

  const ws = wb.addWorksheet('DATA', { tabColor: { argb: 'FFDC2626' } });

  const cols = [
    ['title',                 28, true],
    ['employer_name',         26, true],
    ['employment_type',       18, true],
    ['department',            22, false],
    ['vacancy_type',          16, false],
    ['job_type',              14, false],
    ['work_model',            14, false],
    ['positions_count',       18, false],
    ['status',                12, false],
    ['industry',              16, false],
    ['pay_rate',              12, false],
    ['pay_rate_type',         14, false],
    ['work_location',         22, false],
    ['police_check',          14, false],
    ['drug_alcohol_test',     18, false],
    ['wwc',                   10, false],
    ['car_required',          14, false],
    ['public_transport',      18, false],
    ['wage_subsidy_required', 22, false],
    ['skills_required',       30, false],
    ['skills_desired',        28, false],
    ['description',           40, false],
    ['comments',              28, false],
    ['job_board_url',         30, false],
    ['end_date',              14, false],
    ['deadline',              14, false],
    ['team',                  16, false],
    ['experience_years_min',  22, false],
  ];

  cols.forEach(([h, w, req], i) => {
    ws.getColumn(i + 1).width = w;
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    styleHeader(cell, req);
  });
  ws.getRow(1).height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const samples = [
    ['Warehouse Operator','Acme Manufacturing','full_time','Warehouse & Logistics','full_time','full_time','onsite',2,'draft','Warehouse',28.50,'per_hour','Parramatta NSW 2150','not_required','no','no','no','no','no','RF Scanning,Manual Handling','Forklift Licence','Responsible for pick and pack operations.','Immediate start','https://seek.com.au/job/123','','2026-12-31','Operations',0],
    ['Retail Assistant','Metro Retail Group','part_time','Retail & Customer Service','part_time','part_time','onsite',3,'draft','Retail',24.00,'per_hour','Melbourne VIC 3000','not_required','no','no','no','yes','yes','Customer Service,POS Systems','Fashion Knowledge','Customer-facing role.','Weekends required','','','','Retail',0],
    ['Forklift Driver','Greenfield Logistics','full_time','Warehouse & Logistics','casual','full_time','onsite',1,'draft','Logistics',32.00,'per_hour','Brisbane QLD 4000','yes','yes','no','yes','no','no','Forklift Licence LF','WMS Systems','LF licence operator role.','LF mandatory','','','','Warehouse',1],
  ];
  samples.forEach(row => {
    const r = ws.addRow(row);
    r.eachCell(c => styleDataCell(c));
  });

  addDropdown(ws, 3,  2, 200, '"full_time,part_time,contract,internship"');
  addDropdown(ws, 5,  2, 200, '"full_time,part_time,casual,contract,temporary"');
  addDropdown(ws, 6,  2, 200, '"full_time,part_time,contract,internship"');
  addDropdown(ws, 7,  2, 200, '"onsite,remote,hybrid"');
  addDropdown(ws, 9,  2, 200, '"draft,open,closed,archived"');
  addDropdown(ws, 12, 2, 200, '"per_hour,annual"');
  addDropdown(ws, 14, 2, 200, '"yes,no,not_required"');
  addDropdown(ws, 15, 2, 200, '"yes,no"');
  addDropdown(ws, 16, 2, 200, '"yes,no"');
  addDropdown(ws, 17, 2, 200, '"yes,no"');
  addDropdown(ws, 18, 2, 200, '"yes,no"');
  addDropdown(ws, 19, 2, 200, '"yes,no"');

  addInstructions(wb, [
    ['title',                 'Job/vacancy title', 'Warehouse Operator', true],
    ['employer_name',         'Exact employer name as it exists in the system', 'Acme Manufacturing', true],
    ['employment_type',       'Employment type — choose from dropdown', 'full_time / part_time / contract / internship', true],
    ['department',            'Department name (e.g. from the departments list)', 'Warehouse & Logistics', false],
    ['vacancy_type',          'Vacancy type — choose from dropdown', 'full_time / part_time / casual / contract / temporary', false],
    ['job_type',              'Job type (same options as employment_type)', 'full_time / part_time / contract / internship', false],
    ['work_model',            'Work arrangement', 'onsite / remote / hybrid', false],
    ['positions_count',       'Number of positions available (number)', '2', false],
    ['status',                'Vacancy status — choose from dropdown', 'draft / open / closed / archived', false],
    ['industry',              'Industry sector', 'Warehouse / Retail / Logistics', false],
    ['pay_rate',              'Pay rate amount (number)', '28.50', false],
    ['pay_rate_type',         'Pay rate type — choose from dropdown', 'per_hour / annual', false],
    ['work_location',         'Physical work location address', 'Parramatta NSW 2150', false],
    ['police_check',          'Police check required?', 'yes / no / not_required', false],
    ['drug_alcohol_test',     'Drug & alcohol test required?', 'yes / no', false],
    ['wwc',                   'Working With Children check required?', 'yes / no', false],
    ['car_required',          'Car required for this role?', 'yes / no', false],
    ['public_transport',      'Accessible by public transport?', 'yes / no', false],
    ['wage_subsidy_required', 'Is wage subsidy required for this role?', 'yes / no', false],
    ['skills_required',       'Comma-separated list of required skills', 'RF Scanning,Manual Handling', false],
    ['skills_desired',        'Comma-separated list of desired skills', 'Forklift Licence,WMS Systems', false],
    ['description',           'Full job description text', 'Responsible for...', false],
    ['comments',              'Internal comments', 'Immediate start preferred', false],
    ['job_board_url',         'Link to job ad on Seek / Indeed etc.', 'https://seek.com.au/job/...', false],
    ['end_date',              'Role end date if temporary (YYYY-MM-DD)', '2026-12-31', false],
    ['deadline',              'Application deadline (YYYY-MM-DD)', '2026-10-01', false],
    ['team',                  'Team or business unit', 'Operations', false],
    ['experience_years_min',  'Minimum years of experience required (number)', '1', false],
  ]);

  await wb.xlsx.writeFile(path.join(OUT_DIR, 'vacancies_import_template.xlsx'));
  console.log('✅ vacancies_import_template.xlsx');
}

// ─── Run all ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    await makeCandidates();
    await makeEmployers();
    await makePlacements();
    await makeProviders();
    await makeVacancies();
    console.log('\n🎉 All Excel templates generated in csv-templates/');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
