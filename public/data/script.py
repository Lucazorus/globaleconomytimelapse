import pandas as pd
import json

# 1. Mapping pays → région
regions = pd.read_csv("countrytoregion.csv", names=["country", "region"])
country_to_region = {c.strip(): r.strip() for c, r in zip(regions["country"], regions["region"])}

# 2. Chargement du CSV (header direct)
gdp = pd.read_csv("GDPHABITANT.csv")
gdp.columns = [col.strip().strip('"') for col in gdp.columns]

# 3. Filtrer sur l’indicateur “GDP per capita”
gdp = gdp[gdp["Indicator Name"].str.contains("GDP per capita", case=False, na=False)]

years = [col for col in gdp.columns if col.isdigit()]

rows = []
for idx, row in gdp.iterrows():
    country = row["Country Name"].strip().strip('"')
    region = country_to_region.get(country, None)
    if not region:
        continue
    for year in years:
        gdp_value = row[year]
        if pd.isnull(gdp_value) or gdp_value == "":
            continue
        try:
            gdp_val = float(gdp_value)
        except Exception:
            continue
        rows.append({
            "country": country,
            "year": int(year),
            "gdp": gdp_val,
            "region": region
        })

# 4. Export en JSON
with open("gdp_per_capita_by_country_year.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, indent=2, ensure_ascii=False)

print(f"{len(rows)} lignes exportées.")
