/**
 * Charts Module
 * Gráficos de tendência climática com Chart.js
 */

const Charts = (() => {
  let chart = null;
  let currentType = 'temperature';
  let climateData = null;

  const CHART_CONFIGS = {
    temperature: {
      label: 'Temperatura (°C)',
      borderColor: '#f97316',
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
      gradientTop: 'rgba(249, 115, 22, 0.3)',
      gradientBottom: 'rgba(249, 115, 22, 0)',
      field: 'temperature',
      unit: '°C'
    },
    precipitation: {
      label: 'Precipitação (mm)',
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      gradientTop: 'rgba(59, 130, 246, 0.4)',
      gradientBottom: 'rgba(59, 130, 246, 0)',
      field: 'precipitation',
      unit: 'mm',
      type: 'bar'
    }
  };

  /**
   * Inicializa os event listeners dos tabs
   */
  function init() {
    document.querySelectorAll('.card__tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const chartType = tab.dataset.chart;
        if (chartType && chartType !== currentType) {
          // Atualizar active tab
          document.querySelectorAll('.card__tab').forEach(t => t.classList.remove('card__tab--active'));
          tab.classList.add('card__tab--active');

          currentType = chartType;
          render();
        }
      });
    });
  }

  /**
   * Define os dados climáticos para visualização
   */
  function setData(data) {
    climateData = data;
    render();
  }

  /**
   * Renderiza o gráfico atual
   */
  function render() {
    if (!climateData || !climateData.daily || climateData.daily.length === 0) return;

    const canvas = document.getElementById('climateChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Destruir gráfico anterior
    if (chart) {
      chart.destroy();
    }

    const config = CHART_CONFIGS[currentType];
    const daily = climateData.daily;

    // Preparar dados
    const labels = daily.map(d => {
      const dateStr = d.date;
      return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}`;
    });

    const values = daily.map(d => d[config.field]);

    // Criar gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, config.gradientTop);
    gradient.addColorStop(1, config.gradientBottom);

    const isBar = config.type === 'bar';

    chart = new Chart(ctx, {
      type: isBar ? 'bar' : 'line',
      data: {
        labels,
        datasets: [{
          label: config.label,
          data: values,
          borderColor: config.borderColor,
          backgroundColor: isBar ? config.backgroundColor : gradient,
          borderWidth: isBar ? 0 : 2,
          fill: !isBar,
          tension: 0.4,
          pointRadius: isBar ? 0 : 0,
          pointHoverRadius: isBar ? 0 : 5,
          pointHoverBackgroundColor: config.borderColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          borderRadius: isBar ? 4 : 0,
          barPercentage: 0.6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10, 21, 16, 0.95)',
            borderColor: 'rgba(16, 185, 129, 0.2)',
            borderWidth: 1,
            titleColor: '#86efac',
            bodyColor: '#f0fdf4',
            titleFont: { family: 'Outfit', weight: 600 },
            bodyFont: { family: 'Inter' },
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (ctx) => `${config.label}: ${ctx.parsed.y} ${config.unit}`
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            },
            ticks: {
              color: 'rgba(134, 239, 172, 0.5)',
              font: { family: 'Inter', size: 10 },
              maxTicksLimit: 10,
              maxRotation: 0
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            },
            ticks: {
              color: 'rgba(134, 239, 172, 0.5)',
              font: { family: 'Inter', size: 10 },
              callback: (val) => `${val}${config.unit === '°C' ? '°' : ''}`
            }
          }
        }
      }
    });
  }

  return {
    init,
    setData,
    render
  };
})();
