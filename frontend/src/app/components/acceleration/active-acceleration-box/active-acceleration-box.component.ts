import { Component, ChangeDetectionStrategy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Transaction } from '../../../interfaces/electrs.interface';
import { Acceleration, SinglePoolStats } from '../../../interfaces/node-api.interface';
import { EChartsOption, PieSeriesOption } from '../../../graphs/echarts';
import { MiningStats } from '../../../services/mining.service';

function lighten(color, p): { r, g, b } {
  return {
    r: color.r + ((255 - color.r) * p),
    g: color.g + ((255 - color.g) * p),
    b: color.b + ((255 - color.b) * p),
  };
}

function toRGB({r,g,b}): string {
  return `rgb(${r},${g},${b})`;
}

@Component({
  selector: 'app-active-acceleration-box',
  templateUrl: './active-acceleration-box.component.html',
  styleUrls: ['./active-acceleration-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveAccelerationBox implements OnChanges {
  @Input() tx: Transaction;
  @Input() accelerationInfo: Acceleration;
  @Input() miningStats: MiningStats;
  @Input() pools: number[];
  @Input() chartOnly: boolean = false;
  @Input() chartPositionLeft: boolean = false;

  acceleratedByPercentage: string = '';

  chartOptions: EChartsOption;
  chartInitOptions = {
    renderer: 'svg',
  };
  timespan = '';
  chartInstance: any = undefined;

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    const pools = this.pools || this.accelerationInfo?.pools || this.tx.acceleratedBy;
    if (pools && this.miningStats) {
      this.prepareChartOptions(pools);
    }
  }

  getChartData(poolList: number[]) {
    const data: object[] = [];
    const pools: { [id: number]: SinglePoolStats } = {};
    for (const pool of this.miningStats.pools) {
      pools[pool.poolUniqueId] = pool;
    }

    const getDataItem = (value, color, tooltip, emphasis) => ({
      value,
      name: tooltip,
      itemStyle: {
        color,
      },
    });

    const acceleratingPools = (poolList || []).filter(id => pools[id]).sort((a,b) => pools[a].lastEstimatedHashrate - pools[b].lastEstimatedHashrate);
    const totalAcceleratedHashrate = acceleratingPools.reduce((total, pool) => total + pools[pool].lastEstimatedHashrate, 0);
    acceleratingPools.forEach((poolId, index) => {
      const pool = pools[poolId];
      const poolShare = ((pool.lastEstimatedHashrate / this.miningStats.lastEstimatedHashrate) * 100).toFixed(1);
      data.push(getDataItem(
        pool.lastEstimatedHashrate,
        toRGB(lighten({ r: 147, g: 57, b: 244 }, index * .08)),
        `<b style="color: white">${pool.name} (${poolShare}%)</b>`,
        true,
      ) as PieSeriesOption);
    })
    this.acceleratedByPercentage = ((totalAcceleratedHashrate / this.miningStats.lastEstimatedHashrate) * 100).toFixed(1) + '%';
    const notAcceleratedByPercentage = ((1 - (totalAcceleratedHashrate / this.miningStats.lastEstimatedHashrate)) * 100).toFixed(1) + '%';
    data.push(getDataItem(
      (this.miningStats.lastEstimatedHashrate - totalAcceleratedHashrate),
      'rgba(127, 127, 127, 0.3)',
      $localize`not accelerating` + ` (${notAcceleratedByPercentage})`,
      false,
    ) as PieSeriesOption);

    return data;
  }

  prepareChartOptions(pools: number[]) {
    this.chartOptions = {
      animation: false,
      grid: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
      tooltip: {
        show: true,
        trigger: 'item',
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
        },
        borderColor: '#000',
        formatter: (item) => {
          return item.name;
        }
      },
      series: [
        {
          type: 'pie',
          radius: '100%',
          label: {
            show: false
          },
          labelLine: {
            show: false
          },
          animationDuration: 0,
          data: this.getChartData(pools),
        }
      ]
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }
    this.chartInstance = ec;
  }
}