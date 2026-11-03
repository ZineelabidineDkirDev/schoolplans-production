import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, LoadingState, PageHeader, Panel } from '../../components/ui';
import {
  getDashboardDateRange,
  getNextCourseDates,
  getDashboardWeekday,
  formatDashboardTime,
  summarizeDashboard,
} from '../../business/dashboard/dashboardMetrics';
import { getDashboardData } from '../../data/repositories/dashboardRepository';
import { getSupabaseClient } from '../../data/supabase/client';
import type { DashboardData, DashboardDateRange } from '../../types/dashboard';
import { useAuth } from '../auth/AuthProvider';
import { StudentPortalDashboardPage } from '../students/StudentPortalDashboardPage';

type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: DashboardData };

type ChartMode = 'line' | 'bar' | 'cum';

function DashboardIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5zM4 5.5v16M8 7h8m-8 4h8',
    users:
      'M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m6-7a4 4 0 0 1 0 8m2 3h2a3 3 0 0 1 3 3v1',
    check: 'M5 12l4 4L19 6',
    clock: 'M12 7v5l3 2m5-2a8 8 0 1 1-2.3-5.7M20 4v5h-5',
    formations: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    groups:
      'M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-2h4m-2-2v4',
    refresh: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5',
    filter: 'M3 5h18l-7 8v6l-4-2v-4z',
    line: 'M3 17l6-6 4 4 8-9',
    bars: 'M6 20V10M12 20V4M18 20v-7',
    cumulative: 'M3 20h18M5 16l5-4 4 2 5-8',
  };

  return (
    <svg aria-hidden="true" className="dashboard-icon" viewBox="0 0 24 24">
      <path d={paths[name]} />
    </svg>
  );
}

function DashboardMetric({
  title,
  description,
  value,
  icon,
  detailIcon,
}: {
  title: string;
  description: string;
  value: string | number;
  icon: string;
  detailIcon?: string;
}) {
  return (
    <article className="dashboard-card dashboard-metric">
      <span className="dashboard-metric-icon">
        <DashboardIcon name={icon} />
      </span>
      <div>
        <b>{title}</b>
        <small>{description}</small>
        <strong>{value}</strong>
      </div>
      {detailIcon && (
        <span className="dashboard-metric-detail">
          <DashboardIcon name={detailIcon} />
        </span>
      )}
    </article>
  );
}

function DomainDistribution({ values }: { values: { domain: string; count: number }[] }) {
  const total = values.reduce((sum, item) => sum + item.count, 0);
  if (!total) return <p className="sp-muted">Pas encore de données.</p>;

  const colors: Record<string, string> = {
    Langues: 'var(--lang)',
    Bureautique: 'var(--bur)',
    'Data & IT': 'var(--data)',
    Mathématiques: 'var(--math)',
  };
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = values.map((item) => {
    const length = (item.count / total) * circumference;
    const segment = { ...item, length, offset, color: colors[item.domain] ?? 'var(--brand)' };
    offset += length;
    return segment;
  });

  return (
    <div className="dashboard-donut-layout">
      <svg
        aria-label={`Répartition par domaine, ${total} séances`}
        role="img"
        viewBox="0 0 160 160"
      >
        <g fill="none" strokeWidth="26" transform="rotate(-90 80 80)">
          {segments.map((segment) => (
            <circle
              key={segment.domain}
              cx="80"
              cy="80"
              r={radius}
              stroke={segment.color}
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </g>
        <text className="dashboard-donut-title" textAnchor="middle" x="80" y="76">
          Séances
        </text>
        <text className="dashboard-donut-total" textAnchor="middle" x="80" y="101">
          {total}
        </text>
      </svg>
      <ul className="dashboard-donut-legend">
        {segments.map((segment) => (
          <li key={segment.domain}>
            <span>
              <i style={{ background: segment.color }} />
              {segment.domain}
            </span>
            <strong>
              {segment.count} ({Math.round((segment.count / total) * 100)}%)
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

function getEnrollmentSeries(data: DashboardData, range: DashboardDateRange) {
  const from = new Date(`${range.from}T12:00:00`);
  const to = new Date(`${range.to}T12:00:00`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to < from) return [];

  const monthly = to.getTime() - from.getTime() > 62 * 86400000;
  const values = new Map<string, number>();
  for (let date = new Date(from); date <= to;) {
    const key = monthly
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    values.set(key, 0);
    if (monthly) {
      date = new Date(date.getFullYear(), date.getMonth() + 1, 1, 12);
    } else {
      date.setDate(date.getDate() + 1);
    }
  }

  for (const enrollment of data.enrollments) {
    const createdAt = enrollment.createdAt?.slice(0, 10);
    if (!createdAt) continue;
    const key = monthly ? createdAt.slice(0, 7) : createdAt;
    if (values.has(key)) values.set(key, (values.get(key) ?? 0) + 1);
  }

  return [...values].map(([key, value]) => ({
    label: key.slice(monthly ? 5 : 5).replace('-', '/'),
    value,
  }));
}

function EnrollmentChart({
  data,
  range,
  mode,
}: {
  data: DashboardData;
  range: DashboardDateRange;
  mode: ChartMode;
}) {
  const series = getEnrollmentSeries(data, range);
  const plotted =
    mode === 'cum'
      ? series.map((point, index) => ({
          ...point,
          value: series.slice(0, index + 1).reduce((total, current) => total + current.value, 0),
        }))
      : series;
  const periodTotal = series.reduce((total, point) => total + point.value, 0);
  const maximum = Math.max(1, ...plotted.map((point) => point.value));

  if (!series.length) {
    return <p className="sp-muted">Choisissez une période valide.</p>;
  }

  const width = 760;
  const height = 250;
  const left = 40;
  const right = 16;
  const top = 12;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const interval =
    [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((value) => maximum / value <= 5) ?? 1000;
  const yMaximum = Math.ceil(maximum / interval) * interval;
  const x = (index: number) =>
    left + (plotted.length > 1 ? (index / (plotted.length - 1)) * plotWidth : plotWidth / 2);
  const clampY = (value: number) => Math.max(top, Math.min(top + plotHeight, value));
  const y = (value: number) => clampY(top + plotHeight - (value / yMaximum) * plotHeight);
  const tickIndexes =
    plotted.length <= 6
      ? plotted.map((_, index) => index)
      : Array.from({ length: 6 }, (_, index) => Math.round((index * (plotted.length - 1)) / 5));
  const coordinates = plotted.map((point, index) => [x(index), y(point.value)] as const);
  const curvePath = coordinates
    .map((point, index) => {
      if (index === 0) return `M${point[0]},${point[1]}`;
      const previous = coordinates[index - 1];
      const beforePrevious = coordinates[index - 2] ?? previous;
      const next = coordinates[index + 1] ?? point;
      const firstControl = [
        previous[0] + (point[0] - beforePrevious[0]) / 6,
        clampY(previous[1] + (point[1] - beforePrevious[1]) / 6),
      ];
      const secondControl = [
        point[0] - (next[0] - previous[0]) / 6,
        clampY(point[1] - (next[1] - previous[1]) / 6),
      ];
      return `C${firstControl[0]},${firstControl[1]} ${secondControl[0]},${secondControl[1]} ${point[0]},${point[1]}`;
    })
    .join(' ');
  const areaPath =
    coordinates.length > 0
      ? `${curvePath} L${coordinates.at(-1)?.[0]},${top + plotHeight} L${coordinates[0][0]},${top + plotHeight} Z`
      : '';

  const chartModeLabel = { line: 'Courbe', bar: 'Barres', cum: 'Cumul' }[mode];

  return (
    <div className="dashboard-enrollment-chart">
      <div className="dashboard-chart-summary">
        <strong>{periodTotal.toLocaleString('fr-MA')}</strong>
        <span>
          {mode === 'cum' ? 'inscriptions cumulées en fin de période' : 'inscriptions sur la période'}
        </span>
      </div>
      <div
        className="dashboard-chart"
        role="img"
        aria-label={`Évolution des inscriptions, affichage ${chartModeLabel.toLocaleLowerCase('fr')}`}
      >
      <svg
        aria-hidden="true"
        className="dashboard-chart-svg"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <defs>
          <linearGradient id="dashboard-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity=".22" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: yMaximum / interval + 1 }, (_, index) => {
          const value = index * interval;
          return (
            <g key={value}>
              <line
                className="dashboard-chart-grid"
                x1={left}
                x2={width - right}
                y1={y(value)}
                y2={y(value)}
              />
              <text
                className="dashboard-chart-label"
                textAnchor="end"
                x={left - 8}
                y={y(value) + 4}
              >
                {value}
              </text>
            </g>
          );
        })}
        {tickIndexes.map((index, tickIndex) => (
          <text
            className="dashboard-chart-label"
            key={`${plotted[index].label}-${index}`}
            textAnchor={
              plotted.length < 2
                ? 'middle'
                : tickIndex === 0
                  ? 'start'
                  : tickIndex === tickIndexes.length - 1
                    ? 'end'
                    : 'middle'
            }
            x={x(index)}
            y={height - 8}
          >
            {plotted[index].label}
          </text>
        ))}
        {mode === 'bar' ? (
          plotted.map((point, index) => {
            const barWidth = Math.max(3, Math.min(26, (plotWidth / plotted.length) * 0.6));
            return (
              <rect
                className="dashboard-chart-bar"
                height={top + plotHeight - y(point.value)}
                key={`${point.label}-${index}`}
                rx="3"
                width={barWidth}
                x={x(index) - barWidth / 2}
                y={y(point.value)}
              >
                <title>{point.label} : {point.value} inscription(s)</title>
              </rect>
            );
          })
        ) : (
          <>
            {coordinates.length > 1 && <path className="dashboard-chart-area" d={areaPath} />}
            <path className="dashboard-chart-line" d={curvePath} />
            {coordinates.map((point, index) => (
              <circle
                className="dashboard-chart-point"
                cx={point[0]}
                cy={point[1]}
                key={`${plotted[index].label}-${index}`}
                r="3.5"
              />
            ))}
            {coordinates.map((point, index) => (
              <circle
                className="dashboard-chart-hit-area"
                cx={point[0]}
                cy={point[1]}
                key={`point-${plotted[index].label}-${index}`}
                r="10"
              >
                <title>{plotted[index].label} : {plotted[index].value} inscription(s)</title>
              </circle>
            ))}
          </>
        )}
        {periodTotal === 0 && (
          <text
            className="dashboard-chart-empty"
            dominantBaseline="middle"
            textAnchor="middle"
            x={left + plotWidth / 2}
            y={top + plotHeight / 2}
          >
            Aucune inscription sur cette période
          </text>
        )}
      </svg>
      </div>
    </div>
  );
}

function AttendanceTrendChart({
  presences,
  range,
}: {
  presences: DashboardData['presences'];
  range: DashboardDateRange;
}) {
  const from = new Date(`${range.from}T12:00:00`);
  const to = new Date(`${range.to}T12:00:00`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to < from) {
    return <p className="sp-muted">Choisissez une période valide.</p>;
  }

  const monthly = to.getTime() - from.getTime() > 62 * 86400000;
  const buckets = new Map<string, { label: string; present: number; absent: number }>();
  for (const date = new Date(from); date <= to;) {
    const key = monthly
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    buckets.set(key, {
      label: monthly
        ? date.toLocaleDateString('fr-FR', { month: 'short' })
        : String(date.getDate()),
      present: 0,
      absent: 0,
    });
    if (monthly) date.setMonth(date.getMonth() + 1, 1);
    else date.setDate(date.getDate() + 1);
  }

  for (const presence of presences) {
    const date = presence.date.slice(0, 10);
    if (date < range.from || date > range.to) continue;
    const key = monthly ? date.slice(0, 7) : date;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (presence.status === 'absent') bucket.absent += 1;
    else bucket.present += 1;
  }

  const values = [...buckets.entries()].map(([key, value]) => ({ key, ...value }));
  const measured = values.filter((bucket) => bucket.present + bucket.absent > 0);
  const total = measured.reduce((sum, bucket) => sum + bucket.present + bucket.absent, 0);
  if (!measured.length) {
    return <p className="sp-muted">Aucun pointage de présence sur cette période.</p>;
  }

  const width = 760;
  const height = 250;
  const left = 42;
  const right = 16;
  const top = 14;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const barWidth = Math.max(3, Math.min(24, (plotWidth / values.length) * 0.62));
  const tickIndexes =
    values.length <= 6
      ? values.map((_, index) => index)
      : Array.from({ length: 6 }, (_, index) => Math.round((index * (values.length - 1)) / 5));

  return (
    <div className="dashboard-attendance-chart">
      <div className="dashboard-attendance-summary">
        <strong>{total.toLocaleString('fr-MA')}</strong>
        <span>pointages · les retards comptent comme présence</span>
      </div>
      <div className="dashboard-chart" role="img" aria-label="Présences et absences par période">
        <svg className="dashboard-chart-svg" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {[0, 25, 50, 75, 100].map((rate) => {
            const y = top + plotHeight - (rate / 100) * plotHeight;
            return (
              <g key={rate}>
                <line className="dashboard-chart-grid" x1={left} x2={width - right} y1={y} y2={y} />
                <text className="dashboard-chart-label" textAnchor="end" x={left - 8} y={y + 4}>
                  {rate}%
                </text>
              </g>
            );
          })}
          {values.map((bucket, index) => {
            const pointCount = bucket.present + bucket.absent;
            if (!pointCount) return null;
            const x = left + (values.length > 1 ? (index / (values.length - 1)) * plotWidth : plotWidth / 2);
            const presentHeight = (bucket.present / pointCount) * plotHeight;
            const absentHeight = plotHeight - presentHeight;
            return (
              <g key={bucket.key}>
                {bucket.absent > 0 && (
                  <rect
                    fill="var(--line)"
                    height={absentHeight}
                    rx="3"
                    width={barWidth}
                    x={x - barWidth / 2}
                    y={top}
                  />
                )}
                {bucket.present > 0 && (
                  <rect
                    className="dashboard-chart-bar"
                    height={presentHeight}
                    rx="3"
                    width={barWidth}
                    x={x - barWidth / 2}
                    y={top + absentHeight}
                  />
                )}
                <title>
                  {bucket.key}: {bucket.present} présence(s), {bucket.absent} absence(s)
                </title>
              </g>
            );
          })}
          {tickIndexes.map((index) => {
            const bucket = values[index];
            const x = left + (values.length > 1 ? (index / (values.length - 1)) * plotWidth : plotWidth / 2);
            return (
              <text
                className="dashboard-chart-label"
                key={`${bucket.key}-${index}`}
                textAnchor={index === 0 ? 'start' : index === values.length - 1 ? 'end' : 'middle'}
                x={x}
                y={height - 8}
              >
                {bucket.label}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="dashboard-attendance-legend">
        <span><i className="is-present" /> Présences</span>
        <span><i className="is-absent" /> Absences</span>
      </div>
    </div>
  );
}

function SessionsByWeekdayChart({ counts }: { counts: number[] }) {
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const maximum = Math.max(1, ...counts);

  return (
    <div className="dashboard-weekday-chart" role="img" aria-label="Nombre de cours programmés par jour">
      {days.map((day, index) => {
        const count = counts[index] ?? 0;
        const percentage = (count / maximum) * 100;
        return (
          <div className="dashboard-weekday-column" key={day} title={`${day} : ${count} cours`}>
            <strong>{count}</strong>
            <div className="dashboard-weekday-track">
              <span style={{ height: `${percentage}%` }} />
            </div>
            <small>{day.slice(0, 3)}</small>
          </div>
        );
      })}
    </div>
  );
}

function AttendanceStatusChart({ presences }: { presences: DashboardData['presences'] }) {
  const statuses = [
    { label: 'Présents', value: presences.filter((presence) => presence.status === 'present').length, color: '#14b8a6' },
    { label: 'En retard', value: presences.filter((presence) => presence.status === 'retard').length, color: '#f59e0b' },
    { label: 'Absents', value: presences.filter((presence) => presence.status === 'absent').length, color: '#ef4444' },
    {
      label: 'Autres statuts',
      value: presences.filter((presence) => !['present', 'retard', 'absent'].includes(presence.status)).length,
      color: '#94a3b8',
    },
  ].filter((status) => status.value > 0);
  const total = statuses.reduce((sum, status) => sum + status.value, 0);

  if (!total) return <p className="sp-muted">Aucun pointage sur cette période.</p>;

  let progress = 0;
  const gradient = statuses
    .map((status) => {
      const start = progress;
      progress += (status.value / total) * 100;
      return `${status.color} ${start}% ${progress}%`;
    })
    .join(', ');

  return (
    <div className="dashboard-attendance-status">
      <div
        aria-label={`Répartition de ${total} pointages`}
        className="dashboard-attendance-donut"
        role="img"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div>
          <strong>{total}</strong>
          <span>pointages</span>
        </div>
      </div>
      <ul className="dashboard-attendance-status-legend">
        {statuses.map((status) => (
          <li key={status.label}>
            <span><i style={{ background: status.color }} />{status.label}</span>
            <strong>{status.value} ({Math.round((status.value / total) * 100)}%)</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MOROCCO_CITY_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  tanger: { x: 177, y: 58, label: 'Tanger' },
  tetouan: { x: 218, y: 69, label: 'Tétouan' },
  oujda: { x: 375, y: 119, label: 'Oujda' },
  kenitra: { x: 190, y: 126, label: 'Kénitra' },
  rabat: { x: 205, y: 145, label: 'Rabat' },
  sale: { x: 214, y: 139, label: 'Salé' },
  casablanca: { x: 188, y: 177, label: 'Casablanca' },
  fes: { x: 285, y: 132, label: 'Fès' },
  meknes: { x: 253, y: 125, label: 'Meknès' },
  marrakech: { x: 216, y: 244, label: 'Marrakech' },
  safi: { x: 152, y: 221, label: 'Safi' },
  'beni mellal': { x: 276, y: 204, label: 'Béni Mellal' },
  agadir: { x: 161, y: 306, label: 'Agadir' },
  laayoune: { x: 137, y: 370, label: 'Laâyoune' },
  errachidia: { x: 337, y: 224, label: 'Errachidia' },
  essaouira: { x: 166, y: 267, label: 'Essaouira' },
  'el jadida': { x: 163, y: 194, label: 'El Jadida' },
  khouribga: { x: 235, y: 191, label: 'Khouribga' },
  nador: { x: 331, y: 92, label: 'Nador' },
};

function normalizeCity(city: string): string {
  return city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr');
}

function TeacherStudentCityMap({ values }: { values: DashboardData['studentCities'] }) {
  const total = values.reduce((sum, item) => sum + item.studentCount, 0);
  const cityByKey = new Map(values.map((item) => [normalizeCity(item.city), item]));
  const markers = Object.entries(MOROCCO_CITY_POSITIONS).flatMap(([key, position]) => {
    const value = cityByKey.get(key);
    return value ? [{ ...position, city: value.city, count: value.studentCount, key }] : [];
  });
  return (
    <Panel className="dashboard-panel dashboard-student-map-panel">
      <div className="dashboard-student-map-heading">
        <div>
          <h2>Mes étudiants par ville</h2>
          <p>Répartition des étudiants inscrits à vos cours au Maroc.</p>
        </div>
        <div className="dashboard-student-map-total">
          <strong>{total}</strong>
          <span>étudiants uniques</span>
        </div>
      </div>
      {total === 0 ? (
        <div className="dashboard-student-map-empty">
          <span aria-hidden="true">📍</span>
          <strong>Aucune ville disponible</strong>
          <p>Les villes des étudiants inscrits à vos cours apparaîtront ici dès qu’elles seront renseignées.</p>
        </div>
      ) : (
        <div className="dashboard-student-map-layout">
          <div className="dashboard-morocco-map-wrap">
            <svg className="dashboard-morocco-map" viewBox="0 0 470 420" role="img" aria-label={`Carte schématique du Maroc avec ${markers.length} villes repérées`}>
              <path className="dashboard-morocco-land" d="M105 25 L171 35 L193 55 L231 53 L250 70 L282 76 L304 93 L346 83 L380 105 L399 128 L377 153 L359 176 L344 198 L351 226 L324 248 L308 278 L284 304 L265 333 L241 354 L225 394 L188 380 L171 345 L158 315 L147 282 L133 256 L126 222 L111 194 L116 165 L99 139 L112 110 L98 84 L105 25 Z" />
              <path className="dashboard-morocco-border" d="M105 25 L171 35 L193 55 L231 53 L250 70 L282 76 L304 93 L346 83 L380 105 L399 128 L377 153 L359 176 L344 198 L351 226 L324 248 L308 278 L284 304 L265 333 L241 354 L225 394 L188 380 L171 345 L158 315 L147 282 L133 256 L126 222 L111 194 L116 165 L99 139 L112 110 L98 84 Z" />
              {markers.map((marker) => (
                <g key={marker.key} className="dashboard-morocco-marker">
                  <circle cx={marker.x} cy={marker.y} r="13" />
                  <text x={marker.x} y={marker.y + 4}>{marker.count}</text>
                  <text className="dashboard-morocco-city-label" x={marker.x + 15} y={marker.y - 10}>{marker.label}</text>
                  <title>{marker.label}: {marker.count} étudiant(s)</title>
                </g>
              ))}
            </svg>
            <p className="dashboard-map-caption">Carte schématique · chiffres = effectifs par ville</p>
          </div>
          <div className="dashboard-city-list">
            {values.map((item) => (
              <div className="dashboard-city-row" key={normalizeCity(item.city)}>
                <span><i aria-hidden="true" />{item.city}</span>
                <strong>{item.studentCount}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function TeacherDashboard({ data }: { data: DashboardData }) {
  if (!data.linkedTeacher) {
    return (
      <section className="mx-auto w-full max-w-screen-2xl">
        <PageHeader eyebrow="Espace formateur" title="Mon tableau de bord" />
        <Alert>Votre compte formateur n’est pas encore lié à une fiche formateur.</Alert>
      </section>
    );
  }

  const courseIds = new Set(data.courses.map((course) => String(course.id)));
  const enrollments = data.enrollments.filter((enrollment) =>
    courseIds.has(String(enrollment.courseId)),
  );
  const presences = data.presences.filter((presence) => courseIds.has(String(presence.courseId)));
  const presentCount = presences.filter(
    (presence) => presence.status === 'present' || presence.status === 'retard',
  ).length;
  const attendanceRate = presences.length ? Math.round((presentCount / presences.length) * 100) : 0;
  const studentCount = new Set(enrollments.map((enrollment) => String(enrollment.studentId))).size;
  const monthEnd = new Date();
  const monthStart = new Date(monthEnd.getFullYear(), monthEnd.getMonth() - 5, 1);
  const sixMonthRange = {
    from: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`,
    to: `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`,
  };
  const recentPresences = presences.filter(
    (presence) => presence.date >= sixMonthRange.from && presence.date <= sixMonthRange.to,
  );
  const weeklyCourseCounts = Array.from({ length: 6 }, () => 0);
  for (const course of data.courses) {
    const weekday = (course.weekday + 6) % 7;
    if (weekday >= 0 && weekday < weeklyCourseCounts.length) weeklyCourseCounts[weekday] += 1;
  }
  const upcoming = getNextCourseDates(data.courses);
  const subjectNames = new Map(data.subjects.map((subject) => [String(subject.id), subject.name]));
  const monthlyData = {
    ...data,
    enrollments: enrollments.filter((enrollment) => enrollment.createdAt),
  };

  return (
    <section
      className="mx-auto w-full max-w-screen-2xl space-y-5"
      aria-labelledby="dashboard-title"
    >
      <PageHeader
        description={`Suivez vos cours, vos étudiants et les présences enregistrées pour ${data.linkedTeacher.name}.`}
        eyebrow="Espace formateur"
        title={`Bonjour ${data.linkedTeacher.name}`}
      />

      <div className="dashboard-kpis">
        <DashboardMetric
          description="Cours attribués"
          detailIcon="check"
          icon="book"
          title="Mes cours"
          value={data.courses.length}
        />
        <DashboardMetric
          description="Inscrits à vos cours"
          detailIcon="users"
          icon="users"
          title="Mes étudiants"
          value={studentCount}
        />
        <DashboardMetric
          description="Matières distinctes"
          detailIcon="book"
          icon="formations"
          title="Mes matières"
          value={new Set(data.courses.map((course) => String(course.subjectId)).filter((id) => id !== 'null')).size}
        />
        <DashboardMetric
          description="Sur mes cours"
          detailIcon="check"
          icon="check"
          title="Taux de présence"
          value={`${attendanceRate}%`}
        />
        <DashboardMetric
          description="Total"
          detailIcon="check"
          icon="clock"
          title="Présences enregistrées"
          value={presences.length}
        />
      </div>

      <Panel className="teacher-quick-actions">
        <div>
          <h2>Actions rapides</h2>
          <p className="sp-muted">Accédez directement à vos tâches pédagogiques.</p>
        </div>
        <div className="teacher-quick-action-links">
          <Link className="sp-btn" to="/app/vp">Faire l’appel</Link>
          <Link className="sp-btn sp-btn-ghost" to="/app/vcal">Mon planning</Link>
          <Link className="sp-btn sp-btn-ghost" to="/app/vrapport">Mes rapports</Link>
        </div>
      </Panel>

      <TeacherStudentCityMap values={data.studentCities} />

      <div className="dashboard-columns">
        <Panel>
          <h2>Évolution des inscriptions à mes cours</h2>
          <EnrollmentChart data={monthlyData} range={sixMonthRange} mode="line" />
        </Panel>
        <Panel className="dashboard-panel">
          <h2>Mes prochains cours</h2>
          {upcoming.length ? (
            <ul className="dashboard-upcoming">
              {upcoming.map(({ course, date }) => (
                <li className="dashboard-upcoming-item" key={`${course.id}-${date.toISOString()}`}>
                  <strong>{subjectNames.get(String(course.subjectId)) ?? '?'}</strong>
                  <span>
                    {date.toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                    {' · '}
                    {formatDashboardTime(course.startsAt)} – {formatDashboardTime(course.endsAt)}
                    {course.roomName ? ` · ${course.roomName}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Alert>Aucun prochain cours.</Alert>
          )}
        </Panel>
      </div>

      <Panel className="dashboard-panel">
        <div className="dashboard-heading">
          <div>
            <h2>Présences et absences de mes cours</h2>
            <p className="sp-muted">Suivi des pointages enregistrés au cours des six derniers mois.</p>
          </div>
        </div>
        <AttendanceTrendChart presences={presences} range={sixMonthRange} />
      </Panel>

      <div className="dashboard-analytics-grid">
        <Panel className="dashboard-panel">
          <div className="dashboard-heading">
            <div>
              <h2>Mes cours par jour</h2>
              <p className="sp-muted">Répartition hebdomadaire des cours qui vous sont attribués.</p>
            </div>
          </div>
          <SessionsByWeekdayChart counts={weeklyCourseCounts} />
        </Panel>
        <Panel className="dashboard-panel">
          <div className="dashboard-heading">
            <div>
              <h2>Répartition de mes pointages</h2>
              <p className="sp-muted">Présences, retards et absences sur les six derniers mois.</p>
            </div>
          </div>
          <AttendanceStatusChart presences={recentPresences} />
        </Panel>
      </div>

      <Panel className="dashboard-panel">
        <h2>Mes cours</h2>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-4 py-3 font-semibold" scope="col">
                  Séance
                </th>
                <th className="px-4 py-3 font-semibold" scope="col">
                  Jour
                </th>
                <th className="px-4 py-3 font-semibold" scope="col">
                  Horaire
                </th>
                <th className="px-4 py-3 font-semibold" scope="col">
                  Étudiants
                </th>
              </tr>
            </thead>
            <tbody>
              {data.courses.length ? (
                data.courses.map((course) => (
                  <tr
                    className="border-b border-line last:border-0 hover:bg-slate-50/70"
                    key={String(course.id)}
                  >
                    <td data-label="Séance">{subjectNames.get(String(course.subjectId)) ?? '?'}</td>
                    <td data-label="Jour">{getDashboardWeekday(course.weekday)}</td>
                    <td data-label="Horaire">
                      {formatDashboardTime(course.startsAt)} – {formatDashboardTime(course.endsAt)}
                    </td>
                    <td data-label="Étudiants">
                      {
                        enrollments.filter(
                          (enrollment) => String(enrollment.courseId) === String(course.id),
                        ).length
                      }
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={4}>
                    Aucun cours attribué.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}

export function DashboardPage() {
  const { profile } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('line');
  const [filters, setFilters] = useState({ teacherId: '', courseId: '' });
  const [range, setRange] = useState<DashboardDateRange>(() => getDashboardDateRange('m'));

  useEffect(() => {
    let active = true;
    async function load() {
      setState({ status: 'loading' });
      try {
        if (!profile) throw new Error('Votre profil ne peut pas être chargé.');
        if (profile.role === 'etudiant') {
          if (active) {
            setState({
              status: 'loaded',
              data: {
                linkedTeacher: null,
                courses: [],
                subjects: [],
                teachers: [],
                studentIds: [],
                enrollments: [],
                studentCities: [],
                studentLocations: [],
                presences: [],
                requests: [],
                formationCount: null,
                activeFormationCount: null,
                groupCount: null,
                financeFollowUp: null,
                popularFormations: [],
                closedDates: [],
                cancelledOccurrences: [],
              },
            });
          }
          return;
        }
        const data = await getDashboardData(
          getSupabaseClient(),
          profile.centreId ?? '',
          profile.id,
          profile.role,
        );
        if (active) setState({ status: 'loaded', data });
      } catch (error) {
        if (active) setState({ status: 'error', message: errorMessage(error) });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [profile, reloadKey]);

  const summary = useMemo(
    () =>
      state.status === 'loaded'
        ? summarizeDashboard(
            state.data,
            range,
            filters,
            new Set(state.data.closedDates),
            new Set(state.data.cancelledOccurrences),
          )
        : null,
    [state, range, filters],
  );

  if (state.status === 'loading') {
    return (
      <section className="mx-auto w-full max-w-screen-2xl">
        <Panel>
          <LoadingState label="Chargement du tableau de bord…" />
        </Panel>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section
        className="mx-auto w-full max-w-screen-2xl space-y-5"
        aria-labelledby="dashboard-title"
      >
        <PageHeader eyebrow="Espace membre" title="Tableau de bord" />
        <Alert className="space-y-2" tone="error">
          <p>Le tableau de bord ne peut pas être chargé.</p>
          <p>{state.message}</p>
          <Button onClick={() => setReloadKey((key) => key + 1)} type="button" variant="secondary">
            Réessayer
          </Button>
        </Alert>
      </section>
    );
  }

  if (profile?.role === 'etudiant') return <StudentPortalDashboardPage />;

  if (profile?.role === 'formateur') return <TeacherDashboard data={state.data} />;

  const data = state.data;
  const metrics = summary;
  if (!metrics) return null;

  const todayRange = getDashboardDateRange('d');
  const todayMetrics = summarizeDashboard(
    data,
    todayRange,
    { teacherId: '', courseId: '' },
    new Set(data.closedDates),
    new Set(data.cancelledOccurrences),
  );
  const pendingRequests = data.requests.filter((request) => request.status === 'en_attente').length;
  const outstandingBalance = data.financeFollowUp?.outstandingAmount ?? null;
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayCourseIds = new Set(todayMetrics.occurrences.map((course) => String(course.id)));
  const expectedTodayAttendance = data.enrollments.filter((enrollment) =>
    todayCourseIds.has(String(enrollment.courseId)),
  ).length;
  const todayAttendanceKeys = new Set(data.presences
    .filter((presence) => presence.date.slice(0, 10) === todayDate && todayCourseIds.has(String(presence.courseId)))
    .map((presence) => `${presence.courseId}|${presence.studentId}`));
  const missingTodayAttendance = Math.max(0, expectedTodayAttendance - todayAttendanceKeys.size);
  const selectedCourseIds = new Set(metrics.occurrences.map((course) => String(course.id)));
  const filteredPresences = data.presences.filter(
    (presence) =>
      presence.date >= range.from &&
      presence.date <= range.to &&
      selectedCourseIds.has(String(presence.courseId)),
  );
  const weeklyOccurrenceCounts = Array.from({ length: 6 }, () => 0);
  for (const occurrence of metrics.occurrences) {
    const weekday = (occurrence.weekday + 6) % 7;
    if (weekday >= 0 && weekday < weeklyOccurrenceCounts.length) weeklyOccurrenceCounts[weekday] += 1;
  }

  return (
    <section
      className="mx-auto w-full max-w-screen-2xl space-y-5"
      aria-labelledby="dashboard-title"
    >
      <PageHeader
        description="Suivez les effectifs, les inscriptions, les séances et l’activité de votre centre sur la période choisie."
        eyebrow={profile?.role === 'director' ? 'Pilotage du centre' : 'Vue d’ensemble du centre'}
        title={profile?.role === 'director' ? 'Tableau de bord du centre' : 'Tableau de bord'}
      />

      <div className="dashboard-toolbar" aria-label="Période du tableau de bord">
        <div className="dashboard-periods" role="group" aria-label="Période prédéfinie">
          {(['d', 'w', 'm', 'y'] as const).map((preset) => {
            const presetRange = getDashboardDateRange(preset);
            const isSelected = range.from === presetRange.from && range.to === presetRange.to;
            return (
              <button
                aria-pressed={isSelected}
                className={`dashboard-period${isSelected ? ' active' : ''}`}
                key={preset}
                onClick={() => setRange(presetRange)}
                type="button"
              >
                {{ d: 'Aujourd’hui', w: 'Cette semaine', m: 'Ce mois', y: 'Cette année' }[preset]}
              </button>
            );
          })}
        </div>
        <div className="dashboard-date-range">
          <label>
            Du
            <input
              aria-label="Du"
              onChange={(event) =>
                setRange((current) => ({ ...current, from: event.target.value }))
              }
              type="date"
              value={range.from}
            />
          </label>
          <label>
            Au
            <input
              aria-label="Au"
              onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              type="date"
              value={range.to}
            />
          </label>
        </div>
        <button
          aria-label="Actualiser"
          className="dashboard-action-button"
          onClick={() => setReloadKey((key) => key + 1)}
          title="Actualiser"
          type="button"
        >
          <DashboardIcon name="refresh" />
        </button>
        <button
          aria-expanded={filtersOpen}
          aria-label="Filtres"
          className={`dashboard-action-button${filtersOpen ? ' active' : ''}`}
          onClick={() => setFiltersOpen((open) => !open)}
          title="Filtres"
          type="button"
        >
          <DashboardIcon name="filter" />
        </button>
      </div>

      {filtersOpen && (
        <div className="dashboard-filters">
          <label>
            Formateur
            <select
              className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              onChange={(event) =>
                setFilters((current) => ({ ...current, teacherId: event.target.value }))
              }
              value={filters.teacherId}
            >
              <option value="">Tous les formateurs</option>
              {data.teachers.map((teacher) => (
                <option key={String(teacher.id)} value={String(teacher.id)}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Séance
            <select
              className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              onChange={(event) =>
                setFilters((current) => ({ ...current, courseId: event.target.value }))
              }
              value={filters.courseId}
            >
              <option value="">Toutes les séances</option>
              {data.courses.map((course) => (
                <option key={String(course.id)} value={String(course.id)}>
                  {data.subjects.find((subject) => String(subject.id) === String(course.subjectId))
                    ?.name ?? '?'}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="dashboard-kpis">
        <DashboardMetric
          description="Inscrits et actifs"
          detailIcon="users"
          icon="users"
          title="Total des étudiants"
          value={metrics.studentCount}
        />

        <DashboardMetric
          description="Formations du centre"
          detailIcon="book"
          icon="formations"
          title="Formations"
          value={data.formationCount ?? '—'}
        />
        <DashboardMetric
          description="Actifs sur la période"
          detailIcon="users"
          icon="users"
          title="Formateurs"
          value={metrics.teacherCount}
        />
        <DashboardMetric
          description="Groupes du centre"
          detailIcon="groups"
          icon="groups"
          title="Groupes"
          value={data.groupCount ?? '—'}
        />
        <DashboardMetric
          description="Séances sur la période"
          detailIcon="clock"
          icon="clock"
          title="Séances planifiées"
          value={metrics.occurrences.length}
        />
        <DashboardMetric
          description="Pointages sur la période"
          detailIcon="check"
          icon="check"
          title="Présences enregistrées"
          value={metrics.attendanceCount}
        />
      </div>

      <div className="dashboard-operations-chart-grid">
        <Panel className="dashboard-panel dashboard-operations-panel">
          <div className="dashboard-heading">
            <div>
              <h2>Notes opérationnelles</h2>
              <p className="sp-muted">Les points à vérifier pour assurer le bon fonctionnement du centre.</p>
            </div>
          </div>
          <div className="dashboard-operations-list">
            <Link className="dashboard-operations-item" to="/app/vi">
              <span className="dashboard-metric-icon"><DashboardIcon name="clock" /></span>
              <span>
                <strong>Demandes à traiter</strong>
                <small>{pendingRequests === 0 ? 'Aucune demande en attente' : 'Ouvrir les demandes d’inscription'}</small>
              </span>
              <b>{pendingRequests}</b>
            </Link>
            <Link className="dashboard-operations-item" to="/app/vp">
              <span className="dashboard-metric-icon"><DashboardIcon name="check" /></span>
              <span>
                <strong>Appels à compléter aujourd’hui</strong>
                <small>{missingTodayAttendance > 0 ? 'Ouvrir le suivi des présences' : 'Les appels des séances du jour sont à jour'}</small>
              </span>
              <b>{missingTodayAttendance}</b>
            </Link>
            <Link className="dashboard-operations-item" to="/app/vcal">
              <span className="dashboard-metric-icon"><DashboardIcon name="formations" /></span>
              <span>
                <strong>Programme du jour</strong>
                <small>{todayMetrics.occurrences.length === 0 ? 'Aucune séance planifiée aujourd’hui' : 'Consulter les séances du jour'}</small>
              </span>
              <b>{todayMetrics.occurrences.length}</b>
            </Link>
            <Link className="dashboard-operations-item" to="/app/vfg">
              <span className="dashboard-metric-icon"><DashboardIcon name="book" /></span>
              <span>
                <strong>Formations en cours</strong>
                <small>Formations actives selon les dates des groupes</small>
              </span>
              <b>{data.activeFormationCount ?? '—'}</b>
            </Link>
            <Link className="dashboard-operations-item" to="/app/vfinance">
              <span className="dashboard-metric-icon"><DashboardIcon name="check" /></span>
              <span>
                <strong>Suivi des paiements</strong>
                <small>
                  {data.financeFollowUp
                    ? `${data.financeFollowUp.outstandingChargeCount} frais restant(s) à encaisser`
                    : 'Consulter le suivi financier'}
                </small>
              </span>
              <b>
                {outstandingBalance === null
                  ? '—'
                  : new Intl.NumberFormat('fr-MA', {
                      style: 'currency',
                      currency: 'MAD',
                      maximumFractionDigits: 2,
                    }).format(outstandingBalance)}
              </b>
            </Link>
            <Link className="dashboard-operations-item" to="/app/vi">
              <span className="dashboard-metric-icon"><DashboardIcon name="users" /></span>
              <span>
                <strong>Liste d’attente étudiants</strong>
                <small>
                  {pendingRequests === 0
                    ? 'Aucune demande d’inscription en attente'
                    : 'Demandes d’inscription à examiner'}
                </small>
              </span>
              <b>{pendingRequests}</b>
            </Link>
          </div>
        </Panel>

        <Panel className="dashboard-panel">
          <div className="dashboard-heading dashboard-chart-heading">
            <h2>Évolution des inscriptions</h2>
            <div className="dashboard-chart-controls" aria-label="Mode du graphique">
              {([
                { mode: 'line', label: 'Courbe', icon: 'line' },
                { mode: 'bar', label: 'Histogramme', icon: 'bars' },
                { mode: 'cum', label: 'Cumul', icon: 'cumulative' },
              ] as const).map(({ mode, label, icon }) => (
                <button
                  aria-pressed={chartMode === mode}
                  className={`dashboard-chart-mode${chartMode === mode ? ' active' : ''}`}
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  type="button"
                  title={label}
                >
                  <DashboardIcon name={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <EnrollmentChart data={data} range={range} mode={chartMode} />
        </Panel>
      </div>

      <div className="dashboard-analytics-grid">
        <Panel className="dashboard-panel">
          <div className="dashboard-heading">
            <div>
              <h2>Activité par jour</h2>
              <p className="sp-muted">Séances planifiées selon la période et les filtres choisis.</p>
            </div>
          </div>
          <SessionsByWeekdayChart counts={weeklyOccurrenceCounts} />
        </Panel>
        <Panel className="dashboard-panel">
          <div className="dashboard-heading">
            <div>
              <h2>Répartition des pointages</h2>
              <p className="sp-muted">Présences, retards et absences pour les séances sélectionnées.</p>
            </div>
          </div>
          <AttendanceStatusChart presences={filteredPresences} />
        </Panel>
      </div>

      <div className="dashboard-data-grid">
        <Panel className="dashboard-panel">
          <h2>Séances sur la période</h2>
          {metrics.occurrences.length ? (
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Séance
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Formateur
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Étudiants
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Présences
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.popularSubjects.map((item) => (
                    <tr
                      className="border-b border-line last:border-0 hover:bg-slate-50/70"
                      key={`${item.subject}-${item.teacher}`}
                    >
                      <td data-label="Séance">{item.subject}</td>
                      <td data-label="Formateur">{item.teacher}</td>
                      <td data-label="Étudiants">{item.studentCount}</td>
                      <td data-label="Présences">{item.presentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Alert>Aucun cours ne correspond à ces filtres.</Alert>
          )}
        </Panel>
        <Panel className="dashboard-panel">
          <h2>Formations les plus populaires</h2>
          <p className="sp-muted dashboard-popular-caption">Classement par nombre d’étudiants inscrits</p>
          {data.popularFormations.length ? (
            <ol className="dashboard-popular-bars">
              {data.popularFormations.map((formation) => {
                const maxStudents = Math.max(1, ...data.popularFormations.map((item) => item.studentCount));
                const percentage = Math.round((formation.studentCount / maxStudents) * 100);
                return (
                  <li key={formation.name}>
                    <div className="dashboard-popular-bar-heading">
                      <span title={formation.name}>{formation.name}</span>
                      <strong>{formation.studentCount} étudiant{formation.studentCount === 1 ? '' : 's'}</strong>
                    </div>
                    <div
                      aria-label={`${formation.name} : ${formation.studentCount} étudiant(s)`}
                      className="dashboard-popular-bar-track"
                      role="img"
                    >
                      <span style={{ width: `${percentage}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Alert>Aucune formation trouvée.</Alert>
          )}
        </Panel>
        <Panel className="dashboard-panel">
          <h2>Répartition par domaine</h2>
          <DomainDistribution values={metrics.domainDistribution} />
        </Panel>
      </div>
    </section>
  );
}
