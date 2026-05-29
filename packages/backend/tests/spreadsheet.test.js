import { parseWageSub, parseTransportType, mapRowToCandidate, indexToColLetter } from '../src/services/spreadsheet.js';

describe('indexToColLetter', () => {
  it('converts 0 to A', () => expect(indexToColLetter(0)).toBe('A'));
  it('converts 25 to Z', () => expect(indexToColLetter(25)).toBe('Z'));
  it('converts 26 to AA', () => expect(indexToColLetter(26)).toBe('AA'));
  it('converts 12 to M', () => expect(indexToColLetter(12)).toBe('M'));
});

describe('parseWageSub', () => {
  it('returns false for empty cell', () => {
    expect(parseWageSub('')).toEqual({ wage_subsidy: false, wage_subsidy_amount: null, benchmark_hours: null });
    expect(parseWageSub(null)).toEqual({ wage_subsidy: false, wage_subsidy_amount: null, benchmark_hours: null });
  });

  it('parses dollar amount and hours', () => {
    expect(parseWageSub('$500 / 20hrs')).toEqual({ wage_subsidy: true, wage_subsidy_amount: 500, benchmark_hours: 20 });
  });

  it('parses amount without hours', () => {
    const result = parseWageSub('$1,500');
    expect(result.wage_subsidy).toBe(true);
    expect(result.wage_subsidy_amount).toBe(1500);
    expect(result.benchmark_hours).toBeNull();
  });

  it('sets wage_subsidy true but nulls amounts for unparseable text', () => {
    const result = parseWageSub('maybe');
    expect(result.wage_subsidy).toBe(true);
    expect(result.wage_subsidy_amount).toBeNull();
    expect(result.benchmark_hours).toBeNull();
    expect(result.raw).toBe('maybe');
  });
});

describe('parseTransportType', () => {
  it('returns null for empty', () => expect(parseTransportType('')).toBeNull());
  it('returns car', () => expect(parseTransportType('Car')).toBe('car'));
  it('returns public_transport for PT', () => expect(parseTransportType('PT')).toBe('public_transport'));
  it('returns both for Car/PT', () => expect(parseTransportType('Car / PT')).toBe('both'));
  it('returns null for unrecognised', () => expect(parseTransportType('bus')).toBeNull());
});

describe('mapRowToCandidate', () => {
  const headers = {
    'jobseeker': 0,
    'ec': 1,
    'ideal roles': 2,
    'comments - experience, hours etc': 3,
    'wage sub - max $ & hours': 4,
    'car or pt?': 5,
    'email': 6,
    'mobile': 7,
    'please refer to (ec only)': 8,
    'comments (ec only)': 9,
    'have referred to (wv only)': 10,
    'comments (wv only)': 11,
  };

  const row = [
    'Jane Smith', 'KB', 'Retail', 'Has 5 years exp, 38 hrs', '$500 / 20hrs', 'Car',
    'jane@example.com', '0412345678', 'WorkCover', '', 'Metro Retail', '',
  ];

  it('extracts email as match key', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.email).toBe('jane@example.com');
  });

  it('maps name, phone, interested_job', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.name).toBe('Jane Smith');
    expect(c.phone).toBe('0412345678');
    expect(c.interested_job).toBe('Retail');
  });

  it('parses wage sub fields', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.wage_subsidy).toBe(true);
    expect(c.wage_subsidy_amount).toBe(500);
    expect(c.benchmark_hours).toBe(20);
  });

  it('sets transport_type', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.transport_type).toBe('car');
  });

  it('merges EC, WV, and experience comments into notes', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.notes).toContain('Has 5 years exp');
    expect(c.notes).toContain('[EC: KB]');
    expect(c.notes).toContain('[EC Refer: WorkCover]');
    expect(c.notes).toContain('[WV Refer: Metro Retail]');
  });

  it('sets provider_id', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.provider_id).toBe('provider-1');
  });

  it('returns null email for row with empty email cell', () => {
    const emptyRow = [...row];
    emptyRow[6] = '';
    const c = mapRowToCandidate(headers, emptyRow, 'provider-1');
    expect(c.email).toBe('');
  });
});
