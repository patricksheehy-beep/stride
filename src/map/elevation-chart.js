/**
 * Elevation profile chart component using Chart.js.
 * Renders a responsive line chart showing elevation vs cumulative distance.
 * Also provides elevation statistics calculation (ascent, descent, min/max).
 */
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip
} from 'chart.js';

// Register only the components we need for tree-shaking
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

/**
 * Calculate elevation statistics from a coordinate array.
 *
 * @param {Array<Array<number>>} coordinates - Array of [lng, lat, ele] or [lng, lat] coordinates
 * @returns {{totalAscent: number, totalDescent: number, minEle: number, maxEle: number, elevationRange: number}}
 */
export function calculateElevationStats(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return { totalAscent: 0, totalDescent: 0, minEle: 0, maxEle: 0, elevationRange: 0 };
  }

  let totalAscent = 0;
  let totalDescent = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;
  let prevEle = null;
  let hasValidElevation = false;

  for (const coord of coordinates) {
    const ele = coord[2];
    if (ele === undefined || ele === null) continue;

    hasValidElevation = true;

    if (ele < minEle) minEle = ele;
    if (ele > maxEle) maxEle = ele;

    if (prevEle !== null) {
      const diff = ele - prevEle;
      if (diff > 0) {
        totalAscent += diff;
      } else if (diff < 0) {
        totalDescent += Math.abs(diff);
      }
    }

    prevEle = ele;
  }

  if (!hasValidElevation) {
    return { totalAscent: 0, totalDescent: 0, minEle: 0, maxEle: 0, elevationRange: 0 };
  }

  return {
    totalAscent,
    totalDescent,
    minEle,
    maxEle,
    elevationRange: maxEle - minEle
  };
}

/**
 * Downsample an array to at most maxPoints entries, evenly spaced.
 * @param {Array} arr
 * @param {number} maxPoints
 * @returns {Array}
 */
function downsample(arr, maxPoints) {
  if (arr.length <= maxPoints) return arr;
  const step = arr.length / maxPoints;
  const result = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(arr[Math.floor(i * step)]);
  }
  return result;
}

/**
 * Render an elevation profile chart on a canvas element.
 *
 * @param {HTMLCanvasElement} canvasElement - DOM canvas element to render the chart on
 * @param {Array<Array<number>>} coordinates - Array of [lng, lat, ele] coordinates
 * @returns {Chart} The Chart.js instance
 */
export function renderElevationChart(canvasElement, coordinates) {
  // Downsample to max 200 points for performance
  const sampled = downsample(coordinates, 200);

  // Calculate cumulative distances using simple haversine approximation
  const distances = [0];
  for (let i = 1; i < sampled.length; i++) {
    const dlat = sampled[i][1] - sampled[i - 1][1];
    const dlng = sampled[i][0] - sampled[i - 1][0];
    const dist = Math.sqrt(dlat * dlat + dlng * dlng) * 111.32; // km approximation
    distances.push(distances[i - 1] + dist);
  }

  const labels = distances.map(d => d.toFixed(1));
  const elevations = sampled.map(c => c[2] || 0);

  const chart = new Chart(canvasElement, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: elevations,
        fill: true,
        backgroundColor: 'rgba(232, 197, 71, 0.15)',
        borderColor: '#E8C547',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0].label} km`,
            label: (item) => `${item.raw} m`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Distance (km)', color: '#888' },
          ticks: { color: '#888' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        y: {
          title: { display: true, text: 'Elevation (m)', color: '#888' },
          ticks: { color: '#888' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }
      }
    }
  });

  return chart;
}

/**
 * Safely destroy a Chart.js instance to prevent memory leaks.
 *
 * @param {Chart|null} chartInstance - Chart.js instance to destroy
 */
export function destroyElevationChart(chartInstance) {
  if (chartInstance && typeof chartInstance.destroy === 'function') {
    chartInstance.destroy();
  }
}
