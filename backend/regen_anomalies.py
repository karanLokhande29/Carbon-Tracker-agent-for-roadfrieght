"""Regenerate anomaly_data.json for all 5 years (2023-2027) from the freight CSV."""
import json
import pandas as pd

df = pd.read_csv('data/india_freight_emissions.csv', parse_dates=['date'])

# Compute Monday-aligned week start for each row
df['week_start'] = (df['date'] - pd.to_timedelta(df['date'].dt.dayofweek, unit='d')).dt.strftime('%Y-%m-%d')

# Anomaly weeks: rows flagged with is_anomaly_week == 1
anomaly_df = df[df['is_anomaly_week'] == 1].copy()
print(f'Anomaly rows: {len(anomaly_df)}')
print(f'Years covered: {sorted(anomaly_df["date"].dt.year.unique())}')

# Aggregate per week
records = []
for week_start, group in anomaly_df.groupby('week_start'):
    records.append({
        'date': week_start,
        'lane_count': int(group['lane_id'].nunique()),
        'total_co2e': round(float(group['co2e_kg'].sum()), 1),
        'vehicle_types': list(group['vehicle_type'].unique())[:4],
    })

records.sort(key=lambda x: x['date'])

# Year breakdown
for y in [2023, 2024, 2025, 2026, 2027]:
    count = sum(1 for r in records if r['date'].startswith(str(y)))
    print(f'  {y}: {count} anomaly weeks')

print(f'Total: {len(records)} anomaly weeks')
print('First:', records[0] if records else 'NONE')
print('Last: ', records[-1] if records else 'NONE')

with open('data/anomaly_data.json', 'w') as f:
    json.dump(records, f, indent=2)
print('Saved data/anomaly_data.json')
