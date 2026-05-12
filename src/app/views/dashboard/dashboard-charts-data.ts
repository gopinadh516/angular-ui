import { Injectable } from '@angular/core';
import { ChartData, ChartDataset, ChartOptions, ChartType, PluginOptionsByType, ScaleOptions, TooltipLabelStyle } from 'chart.js';
import { DeepPartial } from 'chart.js/dist/types/utils';
import { getStyle } from '@coreui/utils';

export interface IChartProps {
  data?: ChartData;
  labels?: any;
  options?: ChartOptions;
  colors?: any;
  type: ChartType;
  legend?: any;

  [propName: string]: any;
}

@Injectable({
  providedIn: 'any'
})
export class DashboardChartsData {
  constructor() {
    this.initMainChart();
  }

  public mainChart: IChartProps = { type: 'line' };

  public random(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  initMainChart(period: string = 'Month') {
    const brandSuccess = getStyle('--cui-success') ?? '#4dbd74';
    const brandInfo = getStyle('--cui-info') ?? '#20a8d8';
    const brandInfoBg = `rgba(${getStyle('--cui-info-rgb')}, .1)`;
    const brandDanger = getStyle('--cui-danger') ?? '#f86c6b';

    // Reset Chart Data
    this.mainChart['Data1'] = [];
    this.mainChart['Data2'] = [];
    this.mainChart['Data3'] = [];

    let labels: string[] = [];
    let projectedData: number[] = [];
    let actualData: number[] = [];

    if (period === 'Month') {
        // **Monthly Data**
       // labels = ['November', 'December', 'January', 'February','March','April','May'];
 labels = [

    '2024-12-01',
    '2025-01-01',
    '2025-02-01',
    '2025-03-01',
    '2025-04-01',
    '2025-05-01'
  ];

        projectedData =  [ 319964.41, 508287.56, 616005.41, 433337.06, 486662.23, 181181.79];

        actualData = [  90964.30,  99625.15, 133806.68, 104360.74, 104789.13,  34342.70];
    } 
    else if (period === 'Day') {
  // 1) List every date from your query
  labels = [
    '2025-04-10','2025-04-11','2025-04-12','2025-04-13','2025-04-14',
    '2025-04-15','2025-04-16','2025-04-17','2025-04-18','2025-04-19',
    '2025-04-20','2025-04-21','2025-04-22','2025-04-23','2025-04-24',
    '2025-04-25','2025-04-26','2025-04-27','2025-04-28','2025-04-29',
    '2025-04-30','2025-05-01','2025-05-02','2025-05-03','2025-05-04',
    '2025-05-05','2025-05-06','2025-05-07','2025-05-08','2025-05-09'
  ];

  // 2) Plug in your “total_charges” column
  projectedData = [
    4159.84, 32530.44, 152662.79, 1138.16, 5587.65,
    8816.65, 8369.95, 4153.61, 26648.94, 293.56,
    2660.67, 4067.70, 5914.51, 8660.03, 4583.64,
    5788.97, 113886.86, 2655.46, 6337.80, 7308.18,
    7664.49, 6012.85, 22893.47, 2119.09, 1752.36,
    2391.21, 8623.87, 8051.68, 3637.06, 445.07
  ];

  // 3) Plug in your “total_collected” column
  actualData = [
     702.84, 14503.93,  1318.25,  834.75, 1440.45,
    3190.81,  2791.41,  1458.80, 13826.65, 171.71,
    1190.72,  1627.99,  2628.84, 3281.48, 1892.58,
    1994.78,  9860.45,  1184.23, 2119.62, 2893.86,
    2406.42,  3202.22, 10640.17, 915.06,  567.52,
    1483.60,  3081.55,  2865.52, 1699.45, 159.82
  ];
}
    else if (period === 'Year') {
        // **Yearly Data**
        labels = ['2019', '2020', '2021', '2022', '2023', '2024'];

        projectedData = [
            120_000_000, 130_000_000, 135_000_000, 140_000_000, 145_000_000, 150_000_000
        ];

        actualData = [
            118_000_000, 128_500_000, 132_000_000, 138_000_000, 142_500_000, 148_000_000
        ];
    }

    // **Calculate Variance (Actual - Projected)**
    const varianceData = actualData.map((actual, index) => actual - projectedData[index]);

    // **Assign Values**
    this.mainChart['Data1'] = [...projectedData];  // Projected
    this.mainChart['Data2'] = [...actualData];  // Actual
    this.mainChart['Data3'] = [...varianceData];  // Variance

    // **Define Chart Colors**
    const colors = [
        {
            backgroundColor: brandInfoBg,
            borderColor: brandInfo,
            pointHoverBackgroundColor: brandInfo,
            borderWidth: 2,
            fill: true
        },
        {
            backgroundColor: 'transparent',
            borderColor: brandSuccess || '#4dbd74',
            pointHoverBackgroundColor: '#fff'
        },
        {
            backgroundColor: 'transparent',
            borderColor: brandDanger || '#f86c6b',
            pointHoverBackgroundColor: brandDanger,
            borderWidth: 1,
            borderDash: [8, 5]
        }
    ];

    // **Chart Dataset**
    const datasets: ChartDataset[] = [
        {
            data: this.mainChart['Data1'],
            label: 'Total Billed',
            ...colors[0]
        },
        {
            data: this.mainChart['Data2'],
            label: 'Total Collected',
            ...colors[1]
        },
        {
            data: this.mainChart['Data3'],
            label: 'Charge-Payment Gap',
            ...colors[2]
        }
    ];

    // **Plugins Configuration**
    const plugins: DeepPartial<PluginOptionsByType<any>> = {
        legend: { display: false },
        tooltip: {
            callbacks: {
                labelColor: (context) => ({ backgroundColor: context.dataset.borderColor } as TooltipLabelStyle)
            }
        },
        datalabels: {
    display: true      // ← add this line to suppress on‐chart values
  }
    };

    // **Chart Options**
    const scales = this.getScales();
    const options: ChartOptions = {
        maintainAspectRatio: false,
        plugins,
        scales,
        elements: {
            line: {
                tension: 0.4
            },
            point: {
                radius: 0,
                hitRadius: 10,
                hoverRadius: 4,
                hoverBorderWidth: 3
            }
        }
    };

    // **Set Chart Data**
    this.mainChart.type = 'line';
    this.mainChart.options = options;
    this.mainChart.data = { datasets, labels };
}



// MYCHANGE
getScales() {
  const colorBorderTranslucent = getStyle('--cui-border-color-translucent');
  const colorBody              = getStyle('--cui-body-color');

  // Pull in whatever day-wise numbers you just set on Data1/Data2
  const proj: number[] = this.mainChart['Data1'] as number[];
  const act : number[] = this.mainChart['Data2'] as number[];

  // Combine them to find the true min/max
  const allValues = [...proj, ...act];
  const maxY      = Math.max(...allValues, 0);
  const minY      = Math.min(...allValues, 0);

  // Divide the range into 5 steps
  const range    = maxY - minY;
  const stepSize = range > 0 ? range / 5 : maxY / 5;

  const scales: ScaleOptions<any> = {
    x: {
      grid: {
        color: colorBorderTranslucent,
        drawOnChartArea: false
      },
      ticks: {
        color: colorBody
      }
    },
    y: {
      border: {
        color: colorBorderTranslucent
      },
      grid: {
        color: colorBorderTranslucent
      },
      min:    minY,
      max:    maxY,
      ticks: {
        color:    colorBody,
        stepSize: Math.ceil(stepSize),
        // remove or adjust this callback if you want raw numbers instead of "M"
        callback: (value: number) => {
          // for daily values, you might just return plain number:
          return value.toLocaleString();
        }
      }
    }
  };

  return scales;
}

}

