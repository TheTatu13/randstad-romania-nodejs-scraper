import { jest } from '@jest/globals';

const mockFetch = jest.fn();

jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch
}));

function anafSearchResponse(results) {
  return {
    ok: true,
    json: async () => ({ data: results, success: true })
  };
}

function anafCompanyResponse(data) {
  return {
    ok: true,
    json: async () => ({ data, success: true })
  };
}

function errorResponse(status) {
  return {
    ok: false,
    status,
    text: async () => 'Error'
  };
}

function cuiscanCompanyResponse(data) {
  return {
    ok: true,
    json: async () => data
  };
}

const LSEG_ANAF_RECORD = {
  cui: 39176747,
  name: 'LSEG BUSINESS SERVICES RM S.R.L.',
  address: 'IANCU DE HUNEDOARA, 48, Bucureşti Sectorul 1, Bucureşti',
  caenCode: '6220',
  inactive: false,
  registrationNumber: 'J2014005735405',
  vatRegistered: true,
  onrcStatusLabel: 'Funcțiune',
  legalForm: 'SRL'
};

const CUISCAN_RECORD = {
  cui: 39176747,
  denumire: 'LSEG BUSINESS SERVICES RM S.R.L.',
  adresa: 'IANCU DE HUNEDOARA, 48, Bucureşti Sectorul 1, Bucureşti',
  codCaen: '6220',
  activ: true,
  nrRegCom: 'J2014005735405',
  platitorTVA: true,
  stareInregistrare: 'INREGISTRAT din data 14.05.2014',
  adresaSediu: { strada: 'Bld. Iancu de Hunedoara', numar: '48', localitate: 'Sector 1 Mun. Bucureşti', judet: 'MUNICIPIUL BUCUREŞTI', codPostal: '11745' }
};

const CACHED_DATA = {
  cui: 39176747,
  name: 'LSEG BUSINESS SERVICES RM S.R.L.',
  address: 'MUNICIPIUL BUCUREŞTI, SECTOR 1, BLD IANCU DE HUNEDOARA, NR.48, ET.9',
  registrationNumber: 'J2014005735405',
  caenCode: '6220',
  inactive: false,
  onrcStatusLabel: 'Funcțiune'
};

describe('scraper/anaf.js', () => {
  let anaf;

  beforeAll(async () => {
    anaf = await import('../../src/anaf.js');
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('searchCompany', () => {
    it('should return array of companies for valid brand', async () => {
      mockFetch.mockResolvedValue(anafSearchResponse([
        { cui: 39176747, name: 'LSEG BUSINESS SERVICES RM S.R.L.', statusLabel: 'Funcțiune' }
      ]));

      const results = await anaf.searchCompany('LSEG');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('cui');
      expect(results[0]).toHaveProperty('name');
    });

    it('should return empty array for non-existent brand', async () => {
      mockFetch.mockResolvedValue(anafSearchResponse([]));

      const results = await anaf.searchCompany('NonExistentBrandXYZ123');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should include statusLabel in results', async () => {
      mockFetch.mockResolvedValue(anafSearchResponse([
        { cui: 39176747, name: 'LSEG BUSINESS SERVICES RM S.R.L.', statusLabel: 'Funcțiune' }
      ]));

      const results = await anaf.searchCompany('LSEG');

      expect(results[0]).toHaveProperty('statusLabel', 'Funcțiune');
    });

    it('should fallback to CUIFirma when ANAF search fails', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ cui: 39176747, name: 'LSEG BUSINESS SERVICES RM S.R.L.', is_active: true }] }) });

      const results = await anaf.searchCompany('LSEG');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].cui).toBe('39176747');
    });

    it('should encode brand name in URL', async () => {
      let capturedUrl;
      mockFetch.mockImplementation((url) => {
        capturedUrl = url;
        return Promise.resolve(anafSearchResponse([]));
      });

      await anaf.searchCompany('LSEG SRL');
      expect(capturedUrl).toContain(encodeURIComponent('LSEG SRL'));
    });
  });

  describe('getCompanyFromANAF', () => {
    it('should return company data for valid CIF', async () => {
      mockFetch.mockResolvedValue(anafCompanyResponse(LSEG_ANAF_RECORD));

      const data = await anaf.getCompanyFromANAF('39176747');

      expect(data).toBeDefined();
      expect(data.cui).toBe(39176747);
      expect(data.name).toBe('LSEG BUSINESS SERVICES RM S.R.L.');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('registrationNumber');
    });

    it('should fallback to CUIScan when ANAF fails', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValueOnce(cuiscanCompanyResponse(CUISCAN_RECORD));

      const data = await anaf.getCompanyFromANAF('39176747');

      expect(data).toBeDefined();
      expect(data.cui).toBe(39176747);
      expect(data.name).toBe('LSEG BUSINESS SERVICES RM S.R.L.');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry CUIScan when it answers HTML instead of JSON', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } })
        .mockResolvedValueOnce(cuiscanCompanyResponse(CUISCAN_RECORD));

      const data = await anaf.getCompanyFromANAF('39176747');

      expect(data.name).toBe('LSEG BUSINESS SERVICES RM S.R.L.');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should give up with a clear error when CUIScan keeps answering HTML', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } });

      await expect(anaf.getCompanyFromANAF('39176747')).rejects.toThrow(/non-JSON/);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should fall back to the official ANAF API when CUIScan is unusable', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValueOnce(errorResponse(503))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ found: [{
          date_generale: { cui: 21913994, denumire: 'GAMINVEST SRL', adresa: 'ORADEA', cod_CAEN: '6831' },
          inregistrare_scop_Tva: { scpTVA: true },
          stare_inactiv: { statusInactivi: false }
        }] }) });

      const data = await anaf.getCompanyFromANAF('21913994');

      expect(data.name).toBe('GAMINVEST SRL');
      expect(data.vatRegistered).toBe(true);
      expect(data.inactive).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[2][0]).toContain('webservicesp.anaf.ro');
    });

    it('should throw when both ANAF and CUIScan fail', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      await expect(anaf.getCompanyFromANAF('39176747')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle API-level error response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: { message: 'Company not found' } })
        })
        .mockResolvedValueOnce(errorResponse(500));

      await expect(anaf.getCompanyFromANAF('00000000')).rejects.toThrow();
    });

    it('should return null when data is null', async () => {
      mockFetch.mockResolvedValue(anafCompanyResponse(null));

      const data = await anaf.getCompanyFromANAF('39176747');
      expect(data).toBeNull();
    });
  });

  describe('getCompanyFromANAFWithFallback', () => {
    it('should return fresh data when API works', async () => {
      mockFetch.mockResolvedValue(anafCompanyResponse(LSEG_ANAF_RECORD));

      const data = await anaf.getCompanyFromANAFWithFallback('39176747');

      expect(data.name).toBe('LSEG BUSINESS SERVICES RM S.R.L.');
    });

    it('should use cached data when API fails', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      const data = await anaf.getCompanyFromANAFWithFallback('39176747', CACHED_DATA);

      expect(data).toEqual(CACHED_DATA);
    });

    it('should throw when API fails and no cache available', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      await expect(anaf.getCompanyFromANAFWithFallback('39176747')).rejects.toThrow();
    });
  });
});
