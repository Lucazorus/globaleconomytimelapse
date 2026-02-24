/**
 * EU member states with their year of accession to the European Union.
 * Country names match World Bank naming conventions used in the data files.
 *
 * Sources: official EU records
 * - 1958: founding members (Treaty of Rome, 1957, effective 1958)
 * - 1973: Denmark, Ireland, United Kingdom (UK left in 2020 — Brexit)
 * - 1981: Greece
 * - 1986: Portugal, Spain
 * - 1995: Austria, Finland, Sweden
 * - 2004: Cyprus, Czechia, Estonia, Hungary, Latvia, Lithuania, Malta, Poland, Slovakia, Slovenia
 * - 2007: Bulgaria, Romania
 * - 2013: Croatia
 */

export interface EUMember {
  country: string;
  accessionYear: number;
  /** Year of withdrawal (undefined if still member) */
  withdrawalYear?: number;
}

export const EU_MEMBERS: EUMember[] = [
  // Founding members (1958)
  { country: "Belgium",     accessionYear: 1958 },
  { country: "France",      accessionYear: 1958 },
  { country: "Germany",     accessionYear: 1958 },
  { country: "Italy",       accessionYear: 1958 },
  { country: "Luxembourg",  accessionYear: 1958 },
  { country: "Netherlands", accessionYear: 1958 },

  // 1973 enlargement
  { country: "Denmark",        accessionYear: 1973 },
  { country: "Ireland",        accessionYear: 1973 },
  // UK joined 1973, left 2020 (Brexit — withdrawal effective 1 Feb 2020,
  // transition period ended 31 Dec 2020; we use 2020 as the first year outside)
  { country: "United Kingdom", accessionYear: 1973, withdrawalYear: 2020 },

  // 1981 enlargement
  { country: "Greece",      accessionYear: 1981 },

  // 1986 enlargement
  { country: "Portugal",    accessionYear: 1986 },
  { country: "Spain",       accessionYear: 1986 },

  // 1995 enlargement
  { country: "Austria",     accessionYear: 1995 },
  { country: "Finland",     accessionYear: 1995 },
  { country: "Sweden",      accessionYear: 1995 },

  // 2004 enlargement
  { country: "Cyprus",      accessionYear: 2004 },
  { country: "Czechia",     accessionYear: 2004 },
  { country: "Estonia",     accessionYear: 2004 },
  { country: "Hungary",     accessionYear: 2004 },
  { country: "Latvia",      accessionYear: 2004 },
  { country: "Lithuania",   accessionYear: 2004 },
  { country: "Malta",       accessionYear: 2004 },
  { country: "Poland",      accessionYear: 2004 },
  { country: "Slovakia",    accessionYear: 2004 },
  { country: "Slovenia",    accessionYear: 2004 },

  // 2007 enlargement
  { country: "Bulgaria",    accessionYear: 2007 },
  { country: "Romania",     accessionYear: 2007 },

  // 2013 enlargement
  { country: "Croatia",     accessionYear: 2013 },
];

/**
 * Returns the set of EU member country names that were members in a given year.
 */
export function getEUMembersForYear(year: number): Set<string> {
  const members = new Set<string>();
  for (const m of EU_MEMBERS) {
    if (year >= m.accessionYear && (m.withdrawalYear == null || year < m.withdrawalYear)) {
      members.add(m.country);
    }
  }
  return members;
}

export const EU_REGION = "Europe";
export const EU_LABEL = "European Union";
