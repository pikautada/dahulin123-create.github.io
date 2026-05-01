"use strict";

const APP_VERSION = "20260501-003";
const UI_START_YEAR = 1971;
const ROUTE_API_BASE = `${window.location.protocol}//${window.location.hostname}:8766`;

const DATA_PATHS = {
  stations: "../data/stations_wgs84.geojson",
  segments: "../data/segments_wgs84.geojson",
  lineInfo: "../data/line_info_wgs84.json",
  cities: "../data/cities_wgs84.json",
  years: "../data/year_index_wgs84.json",
};

const BASEMAPS = {
  osm: {
    label: "OSM",
    minZoom: 3,
    maxZoom: 13,
    tileSize: 256,
    background: "#e9eee9",
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  },
  cartoLight: {
    label: "浅色底图",
    minZoom: 3,
    maxZoom: 13,
    tileSize: 256,
    background: "#eef1ef",
    url: (z, x, y) => `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
  },
  cartoLightNoLabels: {
    label: "浅色无标注",
    minZoom: 3,
    maxZoom: 13,
    tileSize: 256,
    background: "#eef1ef",
    url: (z, x, y) => `https://a.basemaps.cartocdn.com/light_nolabels/${z}/${x}/${y}.png`,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
  },
  cartoDark: {
    label: "深色底图",
    minZoom: 3,
    maxZoom: 13,
    tileSize: 256,
    background: "#151a1d",
    url: (z, x, y) => `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
  },
  cartoDarkNoLabels: {
    label: "深色无标注",
    minZoom: 3,
    maxZoom: 13,
    tileSize: 256,
    background: "#151a1d",
    url: (z, x, y) => `https://a.basemaps.cartocdn.com/dark_nolabels/${z}/${x}/${y}.png`,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
  },
  none: {
    label: "无底图",
    minZoom: 3,
    maxZoom: 13,
    tileSize: 256,
    background: "#f7f8f5",
    url: null,
    attribution: "无底图",
  },
};

const tileCache = new Map();

const palette = [
  "#0f766e",
  "#2563eb",
  "#e4572e",
  "#7c3aed",
  "#0f8b8d",
  "#be123c",
  "#5b8c00",
  "#d97706",
  "#4f46e5",
  "#db2777",
  "#2f855a",
  "#b45309",
];

const dom = {
  canvas: document.getElementById("mapCanvas"),
  subtitle: document.getElementById("subtitle"),
  citySelect: document.getElementById("citySelect"),
  lineFilter: document.getElementById("lineFilter"),
  stationSearch: document.getElementById("stationSearch"),
  locateStation: document.getElementById("locateStation"),
  basemapSelect: document.getElementById("basemapSelect"),
  lineWidthRange: document.getElementById("lineWidthRange"),
  stationSizeRange: document.getElementById("stationSizeRange"),
  stationLabelsToggle: document.getElementById("stationLabelsToggle"),
  cityCount: document.getElementById("cityCount"),
  stationCount: document.getElementById("stationCount"),
  segmentCount: document.getElementById("segmentCount"),
  lineCount: document.getElementById("lineCount"),
  newCount: document.getElementById("newCount"),
  mileageCount: document.getElementById("mileageCount"),
  newMileageCount: document.getElementById("newMileageCount"),
  detailTitle: document.getElementById("detailTitle"),
  detailBody: document.getElementById("detailBody"),
  routeOrigin: document.getElementById("routeOrigin"),
  routeDestination: document.getElementById("routeDestination"),
  routeSearch: document.getElementById("routeSearch"),
  routeClear: document.getElementById("routeClear"),
  routeResult: document.getElementById("routeResult"),
  routeStationOptions: document.getElementById("routeStationOptions"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  resetView: document.getElementById("resetView"),
  playToggle: document.getElementById("playToggle"),
  latestYear: document.getElementById("latestYear"),
  speedSelect: document.getElementById("speedSelect"),
  yearJumpButtons: [...document.querySelectorAll(".year-jumps button")],
  yearLabel: document.getElementById("yearLabel"),
  yearRange: document.getElementById("yearRange"),
  attribution: document.querySelector(".attribution"),
};

const ctx = dom.canvas.getContext("2d", { alpha: false });

const state = {
  stations: [],
  segments: [],
  lineInfo: {},
  cities: [],
  years: null,
  year: 2026,
  minYear: UI_START_YEAR,
  maxYear: 2026,
  city: "",
  lineFilter: "",
  stationQuery: "",
  selected: null,
  visibleStations: [],
  visibleSegments: [],
  view: { scale: 1, tx: 0, ty: 0 },
  dpr: 1,
  width: 1,
  height: 1,
  dragging: false,
  dragMoved: false,
  lastPointer: null,
  playTimer: null,
  playbackDelay: 650,
  basemap: "cartoLightNoLabels",
  lineWidthScale: 1,
  stationSizeScale: 1,
  showStationLabels: true,
  route: null,
  routeOptionsKey: "",
  lineOptionsKey: "",
  stationOptionsKey: "",
};

function normalize(text) {
  return String(text || "").replace(/\s+/g, "").toLowerCase();
}

function normalizeStopName(text) {
  return normalize(text).replace(/站$/, "");
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatList(values, limit = 5) {
  const list = [...new Set((values || []).filter(Boolean))];
  if (list.length <= limit) return list.join("、") || "无";
  return `${list.slice(0, limit).join("、")} 等 ${list.length} 项`;
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "无";
  if (value < 3600) return `${Math.round(value / 60)} 分钟`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.round((value - hours * 3600) / 60);
  return `${hours} 小时 ${minutes} 分钟`;
}

function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return "无";
  if (value < 1000) return `${Math.round(value)} 米`;
  return `${(value / 1000).toFixed(2)} 公里`;
}

function formatMileageKm(kilometers) {
  const value = Number(kilometers);
  if (!Number.isFinite(value)) return "0";
  const digits = Math.abs(value) < 100 ? 1 : 0;
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatLineDistance(value) {
  const text = String(value ?? "").trim();
  if (!text) return "无";
  const number = Number(text);
  if (!Number.isFinite(number)) return text;
  return `${number.toFixed(3).replace(/\.?0+$/, "")} 公里`;
}

function formatLinePrice(value) {
  const text = String(value ?? "").trim();
  if (!text) return "无";
  return /^\d+(\.\d+)?$/.test(text) ? `${text} 元` : text;
}

function hashText(text) {
  let hash = 0;
  const value = String(text || "");
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function colorFor(text) {
  return palette[hashText(text) % palette.length];
}

function mercator(lon, lat) {
  const clampedLat = Math.max(-85, Math.min(85, lat));
  const y = Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360)) * (180 / Math.PI);
  return [lon, y];
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function coordinateDistanceKm(left, right) {
  if (!left || !right) return 0;
  const lon1 = Number(left[0]);
  const lat1 = Number(left[1]);
  const lon2 = Number(right[0]);
  const lat2 = Number(right[1]);
  if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) return 0;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pathLengthKm(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return 0;
  let total = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    total += coordinateDistanceKm(coordinates[index], coordinates[index + 1]);
  }
  return total;
}

function roundedCoord(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(6) : "";
}

function stationStatsKey(item) {
  const coord = item.feature?.geometry?.coordinates || [];
  const name = normalize(item.props.name);
  if (name && coord.length >= 2) return `station:${name}:${roundedCoord(coord[0])},${roundedCoord(coord[1])}`;
  return item.props.station_key || `station:${name}`;
}

function segmentStatsKey(item) {
  const titles = [...new Set(item.props.line_titles || [])].map(normalize).filter(Boolean).sort();
  const urls = [...new Set(item.props.line_urls || [])].map(normalize).filter(Boolean).sort();
  const lineKey = titles.length ? titles.join("|") : urls.join("|") || "unknown-line";
  const stationKeys = [...new Set(item.props.station_keys || [])].sort();
  if (stationKeys.length >= 2) return `segment:${lineKey}:${stationKeys.join("|")}`;
  const coords = item.feature?.geometry?.coordinates || [];
  if (coords.length >= 2) {
    const endpoints = [
      `${roundedCoord(coords[0][0])},${roundedCoord(coords[0][1])}`,
      `${roundedCoord(coords[coords.length - 1][0])},${roundedCoord(coords[coords.length - 1][1])}`,
    ].sort();
    return `segment:${lineKey}:${endpoints.join("|")}`;
  }
  return item.props.segment_key || `segment:${lineKey}:${item.props.from_name}|${item.props.to_name}`;
}

function groupedStatsItems(items, keyForItem) {
  const groups = new Map();
  for (const item of items) {
    const key = keyForItem(item);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        count: 1,
        firstOpenYear: item.props.open_year,
        distanceKm: item.distanceKm || 0,
      });
      continue;
    }
    existing.count += 1;
    existing.firstOpenYear = Math.min(existing.firstOpenYear, item.props.open_year);
    existing.distanceKm = Math.max(existing.distanceKm, item.distanceKm || 0);
  }
  return [...groups.values()];
}

function visibleCityCount() {
  if (state.city) return state.visibleStations.length || state.visibleSegments.length ? 1 : 0;
  const cities = new Set();
  for (const item of state.visibleStations) {
    for (const city of item.props.cities || []) cities.add(city);
  }
  for (const item of state.visibleSegments) {
    for (const city of item.props.cities || []) cities.add(city);
  }
  return cities.size;
}

function calculateStats() {
  const lineSet = new Set();
  for (const item of state.visibleSegments) {
    for (const title of item.props.line_titles || []) lineSet.add(title);
  }
  const cityCount = visibleCityCount();

  if (state.city) {
    const newStationCount = state.visibleStations.filter((item) => item.props.open_year === state.year).length;
    const newSegmentCount = state.visibleSegments.filter((item) => item.props.open_year === state.year).length;
    let mileageKm = 0;
    let newMileageKm = 0;
    for (const item of state.visibleSegments) {
      mileageKm += item.distanceKm || 0;
      if (item.props.open_year === state.year) newMileageKm += item.distanceKm || 0;
    }
    return {
      cityCount,
      stationCount: state.visibleStations.length,
      segmentCount: state.visibleSegments.length,
      lineCount: lineSet.size,
      newCount: newStationCount + newSegmentCount,
      mileageKm,
      newMileageKm,
    };
  }

  const stationGroups = groupedStatsItems(state.visibleStations, stationStatsKey);
  const segmentGroups = groupedStatsItems(state.visibleSegments, segmentStatsKey);
  return {
    cityCount,
    stationCount: stationGroups.length,
    segmentCount: segmentGroups.length,
    lineCount: lineSet.size,
    newCount:
      stationGroups.filter((item) => item.firstOpenYear === state.year).length +
      segmentGroups.filter((item) => item.firstOpenYear === state.year).length,
    mileageKm: segmentGroups.reduce((sum, item) => sum + item.distanceKm, 0),
    newMileageKm: segmentGroups
      .filter((item) => item.firstOpenYear === state.year)
      .reduce((sum, item) => sum + item.distanceKm, 0),
  };
}

function scopeLabel(stats) {
  return state.city || `${stats.cityCount}个中国城市`;
}

function projectCoord(coord) {
  return mercator(coord[0], coord[1]);
}

function worldToScreen(projected) {
  return [
    projected[0] * state.view.scale + state.view.tx,
    -projected[1] * state.view.scale + state.view.ty,
  ];
}

function screenToWorld(x, y) {
  return [
    (x - state.view.tx) / state.view.scale,
    (state.view.ty - y) / state.view.scale,
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tileZoomForView() {
  const basemap = BASEMAPS[state.basemap] || BASEMAPS.osm;
  const rawZoom = Math.round(Math.log2((360 * state.view.scale) / basemap.tileSize));
  return clamp(rawZoom, basemap.minZoom, basemap.maxZoom);
}

function tileRecord(z, x, y) {
  const basemap = BASEMAPS[state.basemap] || BASEMAPS.osm;
  const key = `${state.basemap}/${z}/${x}/${y}`;
  const existing = tileCache.get(key);
  if (existing) return existing;

  const img = new Image();
  const record = { img, loaded: false, failed: false };
  img.crossOrigin = "anonymous";
  img.onload = () => {
    record.loaded = true;
    render();
  };
  img.onerror = () => {
    record.failed = true;
    render();
  };
  img.src = basemap.url(z, x, y);
  tileCache.set(key, record);
  return record;
}

function drawBasemap() {
  const basemap = BASEMAPS[state.basemap] || BASEMAPS.osm;
  ctx.save();
  ctx.fillStyle = basemap.background;
  ctx.fillRect(0, 0, state.width, state.height);

  if (!basemap.url) {
    ctx.restore();
    return;
  }

  const z = tileZoomForView();
  const n = 2 ** z;
  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(state.width, state.height);
  const minX = Math.min(topLeft[0], bottomRight[0]);
  const maxX = Math.max(topLeft[0], bottomRight[0]);
  const minY = Math.min(topLeft[1], bottomRight[1]);
  const maxY = Math.max(topLeft[1], bottomRight[1]);

  const x0 = clamp(Math.floor(((minX + 180) / 360) * n), 0, n - 1);
  const x1 = clamp(Math.floor(((maxX + 180) / 360) * n), 0, n - 1);
  const y0 = clamp(Math.floor(((180 - maxY) / 360) * n), 0, n - 1);
  const y1 = clamp(Math.floor(((180 - minY) / 360) * n), 0, n - 1);
  const tileWorldSize = 360 / n;

  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      const left = x * tileWorldSize - 180;
      const top = 180 - y * tileWorldSize;
      const point = worldToScreen([left, top]);
      const size = tileWorldSize * state.view.scale;
      const record = tileRecord(z, x, y);

      if (record.loaded) {
        ctx.drawImage(record.img, point[0], point[1], size + 1, size + 1);
      } else {
        ctx.fillStyle = record.failed ? "#dde4df" : "#eef2ee";
        ctx.fillRect(point[0], point[1], size + 1, size + 1);
      }
    }
  }
  ctx.restore();
}

function projectBounds(bounds) {
  const sw = mercator(bounds[0], bounds[1]);
  const ne = mercator(bounds[2], bounds[3]);
  return [
    Math.min(sw[0], ne[0]),
    Math.min(sw[1], ne[1]),
    Math.max(sw[0], ne[0]),
    Math.max(sw[1], ne[1]),
  ];
}

function fitLngLatBounds(bounds) {
  const projected = projectBounds(bounds);
  const dx = Math.max(0.0001, projected[2] - projected[0]);
  const dy = Math.max(0.0001, projected[3] - projected[1]);
  const padX = Math.min(160, Math.max(42, state.width * 0.08));
  const padY = Math.min(130, Math.max(52, state.height * 0.1));
  const scale = Math.min((state.width - padX * 2) / dx, (state.height - padY * 2) / dy);
  const cx = (projected[0] + projected[2]) / 2;
  const cy = (projected[1] + projected[3]) / 2;
  state.view.scale = Math.max(1, scale);
  state.view.tx = state.width / 2 - cx * state.view.scale;
  state.view.ty = state.height / 2 + cy * state.view.scale;
}

function getActiveBounds() {
  if (state.city) {
    const city = state.cities.find((item) => item.name === state.city);
    if (city) return city.bounds;
  }
  return state.years.global_bounds;
}

function resizeCanvas() {
  const rect = dom.canvas.getBoundingClientRect();
  state.width = Math.max(1, rect.width);
  state.height = Math.max(1, rect.height);
  state.dpr = Math.min(2, window.devicePixelRatio || 1);
  dom.canvas.width = Math.round(state.width * state.dpr);
  dom.canvas.height = Math.round(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

async function loadJson(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${path}${separator}v=${APP_VERSION}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`无法加载 ${path}: ${response.status}`);
  }
  return response.json();
}

async function loadData() {
  const [stations, segments, lineInfo, cities, years] = await Promise.all([
    loadJson(DATA_PATHS.stations),
    loadJson(DATA_PATHS.segments),
    loadJson(DATA_PATHS.lineInfo),
    loadJson(DATA_PATHS.cities),
    loadJson(DATA_PATHS.years),
  ]);

  state.years = years;
  state.lineInfo = lineInfo.lines || {};
  state.minYear = Math.max(UI_START_YEAR, years.earliest_year);
  state.maxYear = years.latest_year;
  state.year = years.default_year;
  state.cities = cities.cities;

  state.stations = stations.features.map((feature) => {
    const props = feature.properties;
    const projected = projectCoord(feature.geometry.coordinates);
    const searchable = normalize(
      [
        props.name,
        ...(props.cities || []),
        ...(props.systems || []),
        ...(props.line_titles || []),
        ...(props.line_names || []),
      ].join(" ")
    );
    return {
      feature,
      props,
      projected,
      color: colorFor((props.line_titles || [props.systems?.[0] || ""])[0]),
      searchable,
    };
  });

  state.segments = segments.features.map((feature) => {
    const props = feature.properties;
    const coordinates = feature.geometry.coordinates || [];
    const projectedPath = coordinates.map(projectCoord);
    const searchable = normalize(
      [
        props.from_name,
        props.to_name,
        ...(props.cities || []),
        ...(props.systems || []),
        ...(props.line_titles || []),
        ...(props.line_names || []),
      ].join(" ")
    );
    return {
      feature,
      props,
      projectedPath,
      distanceKm: pathLengthKm(coordinates),
      color: colorFor((props.line_titles || [props.systems?.[0] || ""])[0]),
      searchable,
    };
  });
}

function populateControls() {
  dom.yearRange.min = String(state.minYear);
  dom.yearRange.max = String(state.maxYear);
  dom.yearRange.value = String(state.year);
  dom.yearLabel.textContent = String(state.year);

  const fragment = document.createDocumentFragment();
  for (const city of [...state.cities].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))) {
    const option = document.createElement("option");
    option.value = city.name;
    option.textContent = city.name;
    fragment.appendChild(option);
  }
  dom.citySelect.appendChild(fragment);
}

function featureInCity(props) {
  return !state.city || (props.cities || []).includes(state.city) || props.city === state.city;
}

function featureMatchesLine(item) {
  return (
    !state.lineFilter ||
    (item.props.line_titles || []).includes(state.lineFilter) ||
    item.searchable.includes(normalize(state.lineFilter))
  );
}

function openInSelectedYear(props) {
  return props.open_year <= state.year && (!props.close_year || state.year < props.close_year);
}

function featureVisible(item) {
  return openInSelectedYear(item.props) && featureInCity(item.props) && featureMatchesLine(item);
}

function refreshVisible() {
  state.visibleSegments = state.segments.filter(featureVisible);
  state.visibleStations = state.stations.filter(featureVisible);
}

function activeInCurrentScope(item) {
  return openInSelectedYear(item.props) && featureInCity(item.props);
}

function optionHtml(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function updateLineOptions() {
  const titles = [
    ...new Set(
      state.segments
        .filter(activeInCurrentScope)
        .flatMap((item) => item.props.line_titles || [])
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  if (state.lineFilter && !titles.includes(state.lineFilter)) {
    state.lineFilter = "";
    state.stationQuery = "";
    state.stationOptionsKey = "";
  }

  const key = `${state.city}|${state.year}|${titles.join("||")}`;
  if (state.lineOptionsKey !== key) {
    state.lineOptionsKey = key;
    dom.lineFilter.innerHTML = [optionHtml("", "全部线路"), ...titles.map((title) => optionHtml(title, title))].join("");
    dom.lineFilter.disabled = titles.length === 0;
  }
  dom.lineFilter.value = state.lineFilter;
}

function updateStationOptions() {
  if (!state.lineFilter) {
    state.stationQuery = "";
    state.stationOptionsKey = "disabled";
    dom.stationSearch.innerHTML = optionHtml("", "先选择线路");
    dom.stationSearch.disabled = true;
    return;
  }

  const names = [...new Set(state.visibleStations.map((item) => item.props.name).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN")
  );
  if (state.stationQuery && !names.some((name) => normalize(name) === normalize(state.stationQuery))) {
    state.stationQuery = "";
  }

  const key = `${state.city}|${state.year}|${state.lineFilter}|${names.join("||")}`;
  if (state.stationOptionsKey !== key) {
    state.stationOptionsKey = key;
    const placeholder = names.length ? "选择站点" : "暂无站点";
    dom.stationSearch.innerHTML = [optionHtml("", placeholder), ...names.map((name) => optionHtml(name, name))].join("");
    dom.stationSearch.disabled = names.length === 0;
  }
  dom.stationSearch.value = state.stationQuery;
}

function updateRouteStationOptions() {
  const key = `${state.city}|${state.year}|${state.lineFilter}|${state.visibleStations.length}`;
  if (state.routeOptionsKey === key) return;
  state.routeOptionsKey = key;

  const names = [...new Set(state.visibleStations.map((item) => item.props.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
    .slice(0, 1500);
  dom.routeStationOptions.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function drawGrid() {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(28, 36, 32, 0.08)";
  ctx.fillStyle = "rgba(28, 36, 32, 0.42)";
  ctx.font = "11px Inter, sans-serif";

  for (let lon = 70; lon <= 140; lon += 5) {
    ctx.beginPath();
    for (let lat = 15; lat <= 55; lat += 1) {
      const point = worldToScreen(mercator(lon, lat));
      if (lat === 15) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    }
    ctx.stroke();
  }

  for (let lat = 15; lat <= 55; lat += 5) {
    ctx.beginPath();
    for (let lon = 70; lon <= 140; lon += 1) {
      const point = worldToScreen(mercator(lon, lat));
      if (lon === 70) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCityLabels() {
  const cities = state.city
    ? state.cities.filter((city) => city.name === state.city)
    : [...state.cities].sort((a, b) => b.station_count - a.station_count).slice(0, 32);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = state.city ? "700 20px Inter, Microsoft YaHei, sans-serif" : "600 12px Inter, Microsoft YaHei, sans-serif";
  ctx.fillStyle = state.city ? "rgba(28, 36, 32, 0.35)" : "rgba(28, 36, 32, 0.36)";

  for (const city of cities) {
    const point = worldToScreen(projectCoord(city.center));
    if (point[0] < -80 || point[0] > state.width + 80 || point[1] < -40 || point[1] > state.height + 40) {
      continue;
    }
    ctx.fillText(city.name, point[0], point[1]);
  }
  ctx.restore();
}

function tracePath(projectedPath) {
  let started = false;
  for (const projected of projectedPath) {
    const point = worldToScreen(projected);
    if (!started) {
      ctx.moveTo(point[0], point[1]);
      started = true;
    } else {
      ctx.lineTo(point[0], point[1]);
    }
  }
}

function drawSegments() {
  const baseWidth = (state.city ? 2.4 : 1.2) * state.lineWidthScale;
  const ordered = [...state.visibleSegments].sort((a, b) => a.props.open_year - b.props.open_year);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const item of ordered) {
    const isNew = item.props.open_year === state.year;
    ctx.beginPath();
    tracePath(item.projectedPath);
    ctx.strokeStyle = isNew ? "#e4572e" : item.color;
    ctx.globalAlpha = isNew ? 0.9 : 0.52;
    ctx.lineWidth = isNew ? baseWidth + 1.7 * state.lineWidthScale : baseWidth;
    ctx.stroke();
  }

  if (state.selected?.type === "segment" || state.selected?.type === "line") {
    ctx.beginPath();
    tracePath(state.selected.item.projectedPath);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#1c2420";
    ctx.lineWidth = baseWidth + 4;
    ctx.stroke();
    ctx.beginPath();
    tracePath(state.selected.item.projectedPath);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = baseWidth + 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoute() {
  if (!state.route?.geometry?.coordinates?.length) return;
  const projectedPath = state.route.geometry.coordinates.map(projectCoord);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  tracePath(projectedPath);
  ctx.strokeStyle = "rgba(28, 36, 32, 0.86)";
  ctx.lineWidth = 8 * state.lineWidthScale;
  ctx.stroke();

  ctx.beginPath();
  tracePath(projectedPath);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 4.2 * state.lineWidthScale;
  ctx.stroke();
  ctx.restore();
}

function routeTransferStopNames() {
  const names = [];
  for (const rawStop of state.route?.transfer_stops || []) {
    for (const stop of String(rawStop).split(/\s*(?:\||->|,|，|、)\s*/)) {
      const name = stop.trim();
      if (name) names.push(name);
    }
  }
  const seen = new Set();
  return names.filter((name) => {
    const key = normalizeStopName(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findRouteNodeByStopName(stopName) {
  const nodes = state.route?.node_path || [];
  const normalized = normalizeStopName(stopName);
  return (
    nodes.find((item) => item.coord && item.name === stopName) ||
    nodes.find((item) => item.coord && normalizeStopName(item.name) === normalized) ||
    null
  );
}

function drawRouteMarkers() {
  if (!state.route) return;
  const markers = [];
  if (state.route.origin?.coord) markers.push({ coord: state.route.origin.coord, color: "#16a34a", label: "起" });
  if (state.route.destination?.coord) markers.push({ coord: state.route.destination.coord, color: "#dc2626", label: "终" });
  routeTransferStopNames().forEach((stopName, index) => {
    const node = findRouteNodeByStopName(stopName);
    if (node) markers.push({ coord: node.coord, color: "#2563eb", label: `换${index + 1}` });
  });
  if (!markers.length) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 10px Inter, Microsoft YaHei, sans-serif";
  for (const marker of markers) {
    const point = worldToScreen(projectCoord(marker.coord));
    const radius = marker.label.length > 1 ? 10 * state.stationSizeScale : 8 * state.stationSizeScale;
    ctx.beginPath();
    ctx.arc(point[0], point[1], radius, 0, Math.PI * 2);
    ctx.fillStyle = marker.color;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(marker.label, point[0], point[1] + 0.5);
  }
  ctx.restore();
}

function drawStations() {
  const query = normalize(state.stationQuery);
  const baseRadius = (state.city ? 3.1 : 1.7) * state.stationSizeScale;

  ctx.save();
  for (const item of state.visibleStations) {
    const point = worldToScreen(item.projected);
    if (point[0] < -10 || point[0] > state.width + 10 || point[1] < -10 || point[1] > state.height + 10) {
      continue;
    }
    const isNew = item.props.open_year === state.year;
    const isSearch = query && item.searchable.includes(query);
    const radius = isSearch
      ? baseRadius + 2.5 * state.stationSizeScale
      : isNew
        ? baseRadius + 1.5 * state.stationSizeScale
        : baseRadius;

    ctx.beginPath();
    ctx.arc(point[0], point[1], radius, 0, Math.PI * 2);
    ctx.fillStyle = isSearch ? "#facc15" : isNew ? "#e4572e" : "#fffdfa";
    ctx.globalAlpha = state.city ? 0.96 : 0.86;
    ctx.fill();
    ctx.lineWidth = isSearch ? 1.7 : 1;
    ctx.strokeStyle = isSearch ? "#1c2420" : item.color;
    ctx.globalAlpha = 0.9;
    ctx.stroke();
  }

  if (state.selected?.type === "station") {
    const point = worldToScreen(state.selected.item.projected);
    ctx.beginPath();
    ctx.arc(point[0], point[1], baseRadius + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(250, 204, 21, 0.34)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1c2420";
    ctx.stroke();
  }
  ctx.restore();
}

function labelIntersects(label, placedLabels) {
  return placedLabels.some(
    (placed) =>
      label.left < placed.right &&
      label.right > placed.left &&
      label.top < placed.bottom &&
      label.bottom > placed.top
  );
}

function drawStationLabels() {
  if (!state.showStationLabels || !state.city || tileZoomForView() < 11) return;
  const query = normalize(state.stationQuery);
  const placedLabels = [];
  const labelItems = [...state.visibleStations].sort((a, b) => {
    const aSelected = state.selected?.type === "station" && state.selected.item === a ? 1 : 0;
    const bSelected = state.selected?.type === "station" && state.selected.item === b ? 1 : 0;
    if (aSelected !== bSelected) return bSelected - aSelected;
    const aSearch = query && a.searchable.includes(query) ? 1 : 0;
    const bSearch = query && b.searchable.includes(query) ? 1 : 0;
    if (aSearch !== bSearch) return bSearch - aSearch;
    return a.props.name.localeCompare(b.props.name, "zh-Hans-CN");
  });

  ctx.save();
  ctx.font = "600 11px Inter, Microsoft YaHei, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  for (const item of labelItems) {
    const name = item.props.name;
    if (!name) continue;
    const point = worldToScreen(item.projected);
    if (point[0] < -40 || point[0] > state.width + 40 || point[1] < -24 || point[1] > state.height + 24) {
      continue;
    }
    const x = point[0] + 7 * state.stationSizeScale;
    const y = point[1] - 7 * state.stationSizeScale;
    const width = ctx.measureText(name).width;
    const bounds = {
      left: x - 3,
      right: x + width + 3,
      top: y - 8,
      bottom: y + 8,
    };
    if (labelIntersects(bounds, placedLabels)) continue;
    placedLabels.push(bounds);

    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeText(name, x, y);
    ctx.fillStyle = "rgba(28, 36, 32, 0.86)";
    ctx.fillText(name, x, y);
  }
  ctx.restore();
}

function updateStats() {
  const stats = calculateStats();

  dom.cityCount.textContent = String(stats.cityCount);
  dom.stationCount.textContent = String(stats.stationCount);
  dom.segmentCount.textContent = String(stats.segmentCount);
  dom.lineCount.textContent = String(stats.lineCount);
  dom.newCount.textContent = String(stats.newCount);
  dom.mileageCount.textContent = formatMileageKm(stats.mileageKm);
  dom.newMileageCount.textContent = formatMileageKm(stats.newMileageKm);
  const basemap = BASEMAPS[state.basemap] || BASEMAPS.osm;
  dom.subtitle.textContent = `WGS84 · ${basemap.label} · ${scopeLabel(stats)} · ${state.year}`;
  dom.attribution.innerHTML = basemap.attribution;
  for (const button of dom.yearJumpButtons) {
    button.classList.toggle("is-active", Number(button.dataset.year) === state.year);
  }
}

function detailRows(rows) {
  return rows
    .map(
      ([key, value]) => `
        <div class="detail-row">
          <div class="detail-key">${escapeHtml(key)}</div>
          <div class="detail-value">${value}</div>
        </div>`
    )
    .join("");
}

function linkValue(url) {
  if (!url) return "无";
  const firstUrl = String(url).split(" / ")[0];
  return `<a href="${escapeHtml(firstUrl)}" target="_blank" rel="noreferrer">维基百科</a>`;
}

function lineInfosForSegment(props) {
  const ids = [...new Set(props.line_ids || [])];
  const lines = ids.map((id) => state.lineInfo[id]).filter(Boolean);
  if (lines.length) return lines;
  return [...new Set(props.line_names || [])].map((name, index) => ({
    line_id: ids[index] || "",
    name,
    title: (props.line_titles || [])[index] || "",
    city: formatList(props.cities || []),
    system: formatList(props.systems || []),
    url: (props.line_urls || [])[index] || (props.line_urls || [])[0] || "",
  }));
}

function lineInfoCards(lines) {
  if (!lines.length) return '<div class="route-note">没有找到该区间关联的整线信息。</div>';
  return lines
    .map(
      (line) => `
        <section class="line-info-card">
          <h3>${escapeHtml(line.name || line.title || line.line_id || "线路")}</h3>
          ${detailRows([
            ["名称", escapeHtml(line.name || "无")],
            ["title", escapeHtml(line.title || "无")],
            ["distance", escapeHtml(formatLineDistance(line.distance))],
            ["basic_price", escapeHtml(formatLinePrice(line.basic_price))],
            ["total_price", escapeHtml(formatLinePrice(line.total_price))],
            ["opening_operation", escapeHtml(line.opening_operation || "无")],
            ["城市", escapeHtml(line.city || "无")],
            ["系统", escapeHtml(line.system || "无")],
            ["line_id", escapeHtml(line.line_id || "无")],
            ["来源", linkValue(line.url)],
          ])}
        </section>`
    )
    .join("");
}

function updateDetails() {
  if (!state.selected) {
    const stats = calculateStats();
    dom.detailTitle.textContent = state.city || "地铁网络";
    dom.detailBody.innerHTML = detailRows([
      ["年份", escapeHtml(state.year)],
      ["范围", escapeHtml(scopeLabel(stats))],
      ["城市", escapeHtml(stats.cityCount)],
      ["站点", escapeHtml(stats.stationCount)],
      ["区间", escapeHtml(stats.segmentCount)],
      ["坐标", "WGS84"],
    ]);
    return;
  }

  const { type, item } = state.selected;
  const props = item.props;
  if (type === "station") {
    dom.detailTitle.textContent = props.name;
    dom.detailBody.innerHTML = detailRows([
      ["类型", "站点"],
      ["开通", escapeHtml(props.open_date)],
      ["城市", escapeHtml(formatList(props.cities))],
      ["系统", escapeHtml(formatList(props.systems))],
      ["线路", escapeHtml(formatList(props.line_titles))],
      ["来源", linkValue(props.station_url)],
    ]);
    return;
  }

  if (type === "line") {
    const lines = state.selected.lines || lineInfosForSegment(props);
    dom.detailTitle.textContent = lines.length === 1 ? lines[0].name || lines[0].title || "线路信息" : `线路信息（${lines.length} 条）`;
    dom.detailBody.innerHTML = `
      ${detailRows([
        ["类型", "整线信息"],
        ["触发区间", `${escapeHtml(props.from_name)} - ${escapeHtml(props.to_name)}`],
        ["关联线路", escapeHtml(formatList(props.line_titles))],
      ])}
      ${lineInfoCards(lines)}
    `;
    return;
  }

  dom.detailTitle.textContent = `${props.from_name} - ${props.to_name}`;
  dom.detailBody.innerHTML = detailRows([
    ["类型", "区间"],
    ["开通", escapeHtml(props.open_date)],
    ["有效期", escapeHtml(props.close_year ? `至 ${props.close_year - 1}` : "持续运营")],
    ["线路", escapeHtml(formatList(props.line_titles))],
    ["城市", escapeHtml(formatList(props.cities))],
    ["系统", escapeHtml(formatList(props.systems))],
    ["跨越", escapeHtml(formatList(props.skipped_station_names || [], 4))],
    ["来源", linkValue((props.line_urls || [])[0])],
  ]);
}

function renderRouteResult(payload) {
  if (!payload) {
    dom.routeResult.textContent = "选择城市和年份后输入起终点。";
    return;
  }
  if (!payload.ok) {
    const suggestions = payload.suggestions?.length
      ? `<div class="route-note">候选：${escapeHtml(payload.suggestions.join("、"))}</div>`
      : "";
    dom.routeResult.innerHTML = `<div>${escapeHtml(payload.message || "没有找到路径。")}</div>${suggestions}`;
    return;
  }

  const metrics = payload.metrics || {};
  const lineItems = (payload.lines_path || [])
    .map((item) => `<li>${item.transfer_to ? "换乘至 " : ""}${escapeHtml(item.line_name || item.line_id)}</li>`)
    .join("");
  const yearNote =
    payload.data_year !== payload.requested_year
      ? `<div class="route-note">当前年份 ${payload.requested_year} 暂无 OD 文件，使用 ${payload.data_year} 年路径数据。</div>`
      : "";

  dom.routeResult.innerHTML = `
    <div><strong>${escapeHtml(payload.origin.name)} → ${escapeHtml(payload.destination.name)}</strong></div>
    <div class="route-kpis">
      <div><strong>${escapeHtml(formatDuration(metrics.duration_sec))}</strong><span>耗时</span></div>
      <div><strong>${escapeHtml(formatDistance(metrics.distance_m))}</strong><span>距离</span></div>
      <div><strong>${escapeHtml(formatDistance(metrics.transfer_walking_distance_m))}</strong><span>步行换乘</span></div>
    </div>
    <div>换乘次数：${escapeHtml(metrics.transfer_count ?? 0)} 次</div>
    <div>换乘站：${escapeHtml(formatList(payload.transfer_stops || [], 8))}</div>
    <ol class="route-line-list">${lineItems}</ol>
    ${yearNote}
  `;
}

function clearRoute() {
  state.route = null;
  renderRouteResult(null);
  render();
}

function fitRouteBounds(route) {
  const coords = route?.geometry?.coordinates || [];
  if (!coords.length) return;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const coord of coords) {
    bounds[0] = Math.min(bounds[0], coord[0]);
    bounds[1] = Math.min(bounds[1], coord[1]);
    bounds[2] = Math.max(bounds[2], coord[0]);
    bounds[3] = Math.max(bounds[3], coord[1]);
  }
  fitLngLatBounds(bounds);
}

async function searchRoute() {
  const origin = dom.routeOrigin.value.trim();
  const destination = dom.routeDestination.value.trim();
  if (!state.city) {
    renderRouteResult({ ok: false, message: "请先在顶部选择城市，再搜索路径。" });
    return;
  }
  if (!origin || !destination) {
    renderRouteResult({ ok: false, message: "请输入起点和终点。" });
    return;
  }

  dom.routeSearch.disabled = true;
  dom.routeResult.textContent = "正在查询路径…";
  try {
    const params = new URLSearchParams({
      city: state.city,
      year: String(state.year),
      origin,
      destination,
    });
    const response = await fetch(`${ROUTE_API_BASE}/route?${params.toString()}`);
    if (!response.ok) throw new Error(`路径服务返回 ${response.status}`);
    const payload = await response.json();
    if (payload.ok) {
      state.route = payload;
      renderRouteResult(payload);
      fitRouteBounds(payload);
      render();
    } else {
      state.route = null;
      renderRouteResult(payload);
      render();
    }
  } catch (error) {
    state.route = null;
    renderRouteResult({
      ok: false,
      message: `路径查询服务未启动或不可访问：${error.message}`,
    });
    render();
  } finally {
    dom.routeSearch.disabled = false;
  }
}

function render() {
  updateLineOptions();
  refreshVisible();
  updateStationOptions();
  updateRouteStationOptions();
  ctx.save();
  drawBasemap();
  drawGrid();
  drawCityLabels();
  drawSegments();
  drawRoute();
  drawStations();
  drawStationLabels();
  drawRouteMarkers();
  ctx.restore();
  updateStats();
  updateDetails();
}

function setYear(year) {
  state.year = Math.max(state.minYear, Math.min(state.maxYear, Number(year)));
  dom.yearRange.value = String(state.year);
  dom.yearLabel.textContent = String(state.year);
  if (state.selected && !openInSelectedYear(state.selected.item.props)) {
    state.selected = null;
  }
  render();
}

function pausePlayback() {
  if (state.playTimer) {
    window.clearInterval(state.playTimer);
    state.playTimer = null;
  }
  dom.playToggle.textContent = "▶";
}

function togglePlayback() {
  if (state.playTimer) {
    pausePlayback();
    return;
  }
  state.route = null;
  renderRouteResult(null);
  if (state.year >= state.maxYear) setYear(state.minYear);
  dom.playToggle.textContent = "Ⅱ";
  state.playTimer = window.setInterval(() => {
    if (state.year >= state.maxYear) {
      pausePlayback();
      return;
    }
    setYear(state.year + 1);
  }, state.playbackDelay);
}

function zoomAt(cx, cy, factor) {
  const before = screenToWorld(cx, cy);
  state.view.scale = Math.max(1, Math.min(220000, state.view.scale * factor));
  state.view.tx = cx - before[0] * state.view.scale;
  state.view.ty = cy + before[1] * state.view.scale;
  render();
}

function distanceToSegmentSquared(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return (px - x) ** 2 + (py - y) ** 2;
}

function pickStation(x, y) {
  let best = null;
  let bestDistance = 10 * 10;
  for (const item of state.visibleStations) {
    const point = worldToScreen(item.projected);
    const distance = (point[0] - x) ** 2 + (point[1] - y) ** 2;
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

function pickSegment(x, y) {
  let best = null;
  let bestDistance = 7 * 7;
  for (const item of state.visibleSegments) {
    const points = item.projectedPath.map(worldToScreen);
    for (let index = 0; index < points.length - 1; index += 1) {
      const distance = distanceToSegmentSquared(
        x,
        y,
        points[index][0],
        points[index][1],
        points[index + 1][0],
        points[index + 1][1]
      );
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
  }
  return best;
}

function handlePick(event) {
  const rect = dom.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const station = pickStation(x, y);
  if (station) {
    state.selected = { type: "station", item: station };
    render();
    return;
  }
  const segment = pickSegment(x, y);
  if (segment) {
    state.selected = { type: "segment", item: segment };
    render();
    return;
  }
  state.selected = null;
  render();
}

function handleLineDoublePick(event) {
  const rect = dom.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const segment = pickSegment(x, y);
  if (!segment) return;
  state.selected = { type: "line", item: segment, lines: lineInfosForSegment(segment.props) };
  render();
}

function fitFeature(item, type) {
  if (type === "station") {
    const coord = item.feature.geometry.coordinates;
    const delta = 0.035;
    fitLngLatBounds([coord[0] - delta, coord[1] - delta, coord[0] + delta, coord[1] + delta]);
    return;
  }
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const coord of item.feature.geometry.coordinates) {
    bounds[0] = Math.min(bounds[0], coord[0]);
    bounds[1] = Math.min(bounds[1], coord[1]);
    bounds[2] = Math.max(bounds[2], coord[0]);
    bounds[3] = Math.max(bounds[3], coord[1]);
  }
  fitLngLatBounds(bounds);
}

function locateStation() {
  const query = normalize(state.stationQuery);
  if (!query) return;
  const pool = state.visibleStations.length
    ? state.visibleStations
    : state.stations.filter((item) => openInSelectedYear(item.props) && featureInCity(item.props) && featureMatchesLine(item));
  const match =
    pool.find((item) => normalize(item.props.name) === query) ||
    pool.find((item) => item.searchable.includes(query));
  if (!match) return;
  state.selected = { type: "station", item: match };
  fitFeature(match, "station");
  render();
}

function bindEvents() {
  window.addEventListener("resize", () => {
    resizeCanvas();
    fitLngLatBounds(getActiveBounds());
    render();
  });

  dom.yearRange.addEventListener("input", () => {
    pausePlayback();
    state.route = null;
    renderRouteResult(null);
    setYear(dom.yearRange.value);
  });

  dom.playToggle.addEventListener("click", togglePlayback);
  dom.latestYear.addEventListener("click", () => {
    pausePlayback();
    state.route = null;
    renderRouteResult(null);
    setYear(state.maxYear);
  });

  for (const button of dom.yearJumpButtons) {
    button.addEventListener("click", () => {
      pausePlayback();
      state.route = null;
      renderRouteResult(null);
      setYear(Number(button.dataset.year));
    });
  }

  dom.speedSelect.addEventListener("change", () => {
    state.playbackDelay = Number(dom.speedSelect.value) || 650;
    if (state.playTimer) {
      pausePlayback();
      togglePlayback();
    }
  });

  dom.basemapSelect.addEventListener("change", () => {
    state.basemap = dom.basemapSelect.value;
    render();
  });

  dom.lineWidthRange.addEventListener("input", () => {
    state.lineWidthScale = Number(dom.lineWidthRange.value) || 1;
    render();
  });

  dom.stationSizeRange.addEventListener("input", () => {
    state.stationSizeScale = Number(dom.stationSizeRange.value) || 1;
    render();
  });

  dom.stationLabelsToggle.addEventListener("change", () => {
    state.showStationLabels = dom.stationLabelsToggle.checked;
    render();
  });

  dom.citySelect.addEventListener("change", () => {
    state.city = dom.citySelect.value;
    state.lineFilter = "";
    state.stationQuery = "";
    state.selected = null;
    state.route = null;
    renderRouteResult(null);
    dom.routeOrigin.value = "";
    dom.routeDestination.value = "";
    state.routeOptionsKey = "";
    state.lineOptionsKey = "";
    state.stationOptionsKey = "";
    fitLngLatBounds(getActiveBounds());
    render();
  });

  dom.lineFilter.addEventListener("change", () => {
    state.lineFilter = dom.lineFilter.value;
    state.stationQuery = "";
    state.selected = null;
    render();
  });

  dom.stationSearch.addEventListener("change", () => {
    state.stationQuery = dom.stationSearch.value;
    if (state.stationQuery) locateStation();
    else {
      state.selected = null;
      render();
    }
  });
  dom.stationSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") locateStation();
  });
  dom.locateStation.addEventListener("click", locateStation);
  dom.routeSearch.addEventListener("click", searchRoute);
  dom.routeClear.addEventListener("click", clearRoute);
  dom.routeDestination.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchRoute();
  });
  dom.routeOrigin.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      if (dom.routeDestination.value.trim()) searchRoute();
      else dom.routeDestination.focus();
    }
  });

  dom.zoomIn.addEventListener("click", () => zoomAt(state.width / 2, state.height / 2, 1.35));
  dom.zoomOut.addEventListener("click", () => zoomAt(state.width / 2, state.height / 2, 1 / 1.35));
  dom.resetView.addEventListener("click", () => {
    fitLngLatBounds(getActiveBounds());
    render();
  });

  dom.canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = dom.canvas.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.16 : 1 / 1.16;
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
    },
    { passive: false }
  );

  dom.canvas.addEventListener("pointerdown", (event) => {
    dom.canvas.setPointerCapture(event.pointerId);
    dom.canvas.classList.add("is-dragging");
    state.dragging = true;
    state.dragMoved = false;
    state.lastPointer = { x: event.clientX, y: event.clientY };
  });

  dom.canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging || !state.lastPointer) return;
    const dx = event.clientX - state.lastPointer.x;
    const dy = event.clientY - state.lastPointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) state.dragMoved = true;
    state.view.tx += dx;
    state.view.ty += dy;
    state.lastPointer = { x: event.clientX, y: event.clientY };
    render();
  });

  dom.canvas.addEventListener("pointerup", (event) => {
    dom.canvas.releasePointerCapture(event.pointerId);
    dom.canvas.classList.remove("is-dragging");
    const shouldPick = !state.dragMoved;
    state.dragging = false;
    state.lastPointer = null;
    if (shouldPick) handlePick(event);
  });
  dom.canvas.addEventListener("dblclick", handleLineDoublePick);
}

async function init() {
  try {
    resizeCanvas();
    await loadData();
    populateControls();
    fitLngLatBounds(getActiveBounds());
    bindEvents();
    render();
  } catch (error) {
    dom.detailTitle.textContent = "加载失败";
    dom.detailBody.textContent = error.message;
    throw error;
  }
}

init();
