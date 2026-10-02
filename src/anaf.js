/**
 * Company Data Module — ANAF + CUIScan + CUIFirma
 *
 * Strategy: 1 try demoanaf.ro → 1 try cuiscan.ro → official ANAF (webservicesp.anaf.ro) → cached data. demoanaf is never retried; cuiscan/cuifirma retry only when they answer HTML instead of JSON.
 * Search: 1 try demoanaf.ro → 1 try cuifirma.ro.
 */

import fetch from "node-fetch";
const userAgent = "job_seeker_ro_spider";

const ANAF_API_URL = "https://demoanaf.ro/api/company/";
const ANAF_SEARCH_URL = "https://demoanaf.ro/api/search";
const CUISCAN_API_URL = "https://cuiscan.ro/api.php";
const CUISFIRMA_SEARCH_URL = "https://cuifirma.ro/api/search";
const TIMEOUT_MS = 10000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * cuiscan.ro / cuifirma.ro sometimes answer 200 with an HTML page (rate limit / challenge)
 * instead of JSON. Retry a few times with a growing pause before giving up.
 */
async function readJson(doFetch, label, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await doFetch();
    if (!res.ok) throw new Error(`${label} error: ${res.status}`);
    try {
      return await res.json();
    } catch (err) {
      if (attempt === attempts) throw new Error(`${label} returned non-JSON (rate limited?)`);
      await sleep(1500 * attempt);
    }
  }
}
// ============================================================================
// CUIScan — company details fallback
// ============================================================================

function mapCuiscanToAnafFormat(data) {
  return {
    cui: data.cui,
    name: data.denumire,
    address: data.adresa,
    registrationNumber: data.nrRegCom,
    phone: data.telefon || "",
    fax: data.fax || "",
    postalCode: data.codPostal,
    caenCode: data.codCaen,
    iban: data.iban || "",
    registrationState: data.stareInregistrare,
    registrationDate: data.dataInregistrare,
    fiscalAuthority: data.organFiscal,
    ownershipForm: data.formaProprietate,
    organizationForm: data.formaOrganizare,
    legalForm: data.formaJuridica,
    vatRegistered: data.platitorTVA,
    vatPeriods: (data.perioadeTVA || []).map(p => ({
      start: p.dataStart, end: p.dataEnd || null, yearStart: "", message: p.mesaj || ""
    })),
    cashBasisVat: data.tvaIncasare || false,
    cashBasisVatStart: data.dataInceputTvaInc || null,
    cashBasisVatEnd: data.dataSfarsitTvaInc || null,
    inactive: !data.activ,
    inactiveSince: data.dataInactivare || null,
    reactivatedSince: data.dataReactivare || null,
    splitVat: data.splitTVA || false,
    eFacturaRegistered: data.eFactura || false,
    headquartersAddress: data.adresaSediu ? {
      street: data.adresaSediu.strada || "",
      number: data.adresaSediu.numar || "",
      locality: data.adresaSediu.localitate || "",
      county: data.adresaSediu.judet || "",
      country: "",
      postalCode: data.adresaSediu.codPostal || ""
    } : { street: "", number: "", locality: "", county: "", country: "", postalCode: "" },
    fiscalAddress: { street: "", number: "", locality: "", county: "", country: "", postalCode: "" },
    administrators: (data.administratori || []).map(a => ({
      name: a.nume || a.name || "", role: a.rol || a.role || "administrator"
    })),
    authorizedCaenCodes: data.caenAutorizate || [],
    onrcStatus: 0,
    onrcStatusLabel: data.activ ? "Funcțiune" : "Inactiv"
  };
}

async function fetchFromCuiscan(cif) {
  const json = await readJson(() => fetch(`${CUISCAN_API_URL}?action=company&cui=${cif}`, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  }), "CUIScan API");
  if (!json || !json.denumire) throw new Error("CUIScan returned no data");
  return mapCuiscanToAnafFormat(json);
}

// ============================================================================
// Official ANAF (webservicesp.anaf.ro) — authoritative last-resort fallback
// ============================================================================

const OFFICIAL_ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";

export function mapOfficialAnafToAnafFormat(found) {
  const g = found.date_generale || {};
  const tva = found.inregistrare_scop_Tva || {};
  const inactiv = found.stare_inactiv || {};
  const sediu = found.adresa_sediu_social || {};
  const fiscal = found.adresa_domiciliu_fiscal || {};
  const addr = (a) => ({
    street: a.sdenumire_Strada || a.ddenumire_Strada || "",
    number: a.snumar_Strada || a.dnumar_Strada || "",
    locality: a.sdenumire_Localitate || a.ddenumire_Localitate || "",
    county: a.sdenumire_Judet || a.ddenumire_Judet || "",
    country: a.sdenumire_Tara || a.dtara || "",
    postalCode: a.scod_Postal || a.dcod_Postal || ""
  });
  return {
    cui: g.cui,
    name: g.denumire,
    address: g.adresa,
    registrationNumber: g.nrRegCom,
    phone: g.telefon || "",
    fax: g.fax || "",
    postalCode: g.codPostal,
    caenCode: g.cod_CAEN,
    iban: g.iban || "",
    registrationState: g.stare_inregistrare,
    registrationDate: g.data_inregistrare,
    fiscalAuthority: g.organFiscalCompetent || "",
    ownershipForm: g.forma_de_proprietate || "",
    organizationForm: g.forma_organizare || "",
    legalForm: g.forma_juridica || "",
    vatRegistered: !!tva.scpTVA,
    vatPeriods: (tva.perioade_TVA ? [tva.perioade_TVA] : []).map(p => ({
      start: p.data_inceput_ScpTVA || "", end: p.data_sfarsit_ScpTVA || null, yearStart: "", message: p.mesaj_ScpTVA || ""
    })),
    cashBasisVat: false,
    cashBasisVatStart: null,
    cashBasisVatEnd: null,
    inactive: !!inactiv.statusInactivi,
    inactiveSince: inactiv.dataInactivare || null,
    reactivatedSince: inactiv.dataReactivare || null,
    splitVat: false,
    eFacturaRegistered: !!g.statusRO_e_Factura,
    headquartersAddress: addr(sediu),
    fiscalAddress: addr(fiscal),
    administrators: [],
    authorizedCaenCodes: [],
    onrcStatus: 0,
    onrcStatusLabel: inactiv.statusInactivi ? "Inactiv" : "Funcțiune"
  };
}

async function fetchFromOfficialAnaf(cif) {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(OFFICIAL_ANAF_URL, {
    method: "POST",
    headers: { "User-Agent": userAgent, "Content-Type": "application/json" },
    body: JSON.stringify([{ cui: Number(cif), data: today }]),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`ANAF official API error: ${res.status}`);
  let json;
  try { json = await res.json(); } catch (e) { throw new Error("ANAF official API returned non-JSON"); }
  const found = json && json.found && json.found[0];
  if (!found || !found.date_generale || !found.date_generale.denumire) throw new Error("ANAF official API returned no data");
  return mapOfficialAnafToAnafFormat(found);
}

// ============================================================================
// ANAF — primary source
// ============================================================================

async function fetchFromAnaf(cif) {
  const res = await fetch(`${ANAF_API_URL}${cif}`, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`ANAF API error: ${res.status}`);
  const json = await res.json();
  if (json.success === false) throw new Error(json.error?.message || "ANAF returned error");
  return json.data || null;
}

async function searchFromAnaf(brandName) {
  const res = await fetch(`${ANAF_SEARCH_URL}?q=${encodeURIComponent(brandName)}`, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`ANAF search error: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

// ============================================================================
// CUIFirma — search fallback
// ============================================================================

async function searchFromCuifirma(brandName) {
  const json = await readJson(() => fetch(`${CUISFIRMA_SEARCH_URL}?q=${encodeURIComponent(brandName)}`, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  }), "CUIFirma search");
  return (json.results || []).map(r => ({
    cui: String(r.cui),
    name: r.name,
    statusLabel: r.is_active ? "Funcțiune" : (r.status_label || "Inactiv")
  }));
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fetches company by CIF — ANAF first, CUIScan fallback
 */
export async function getCompanyFromANAF(cif) {
  try {
    console.log(`Fetching company data for CIF: ${cif} (demoanaf.ro)...`);
    return await fetchFromAnaf(cif);
  } catch (err) {
    console.log(`DemoANAF failed: ${err.message} — trying cuiscan.ro...`);
    try {
      return await fetchFromCuiscan(cif);
    } catch (err2) {
      console.log(`CUIScan failed: ${err2.message} — trying official ANAF API...`);
      return await fetchFromOfficialAnaf(cif);
    }
  }
}

/**
 * Fetches company with fallback to cached data
 */
export async function getCompanyFromANAFWithFallback(cif, cachedData = null) {
  try {
    return await getCompanyFromANAF(cif);
  } catch (err) {
    console.log(`\n⚠️ All company data sources unavailable: ${err.message}`);
    if (cachedData) {
      console.log("✅ Using cached company data as fallback");
      return cachedData;
    }
    throw err;
  }
}

/**
 * Searches companies by brand — ANAF first, CUIFirma fallback
 */
export async function searchCompany(brandName) {
  try {
    return await searchFromAnaf(brandName);
  } catch (err) {
    console.log(`DemoANAF search failed: ${err.message} — trying cuifirma.ro...`);
    return await searchFromCuifirma(brandName);
  }
}
