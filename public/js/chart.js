// YouTube統計グラフ管理クラス
class StatsCharts {
  constructor() {
    this.viewsChartInstance = null;
    this.likesChartInstance = null;
    this.commentsChartInstance = null; // コメント数用のグラフを追加
    this.viewsData = {
      labels: [],
      values: []
    };
    this.likesData = {
      labels: [],
      values: []
    };
    this.commentsData = { // コメントデータの追加
      labels: [],
      values: []
    };
    this.maxDataPoints = 20; // グラフに表示する最大データポイント数
  }
  
  // グラフを初期化
  initCharts() {
    try {
      this.destroyCharts();
      
      // キャンバス要素の取得確認
      const viewsCtx = document.getElementById('viewsChart')?.getContext('2d');
      const likesCtx = document.getElementById('likesChart')?.getContext('2d');
      const commentsCtx = document.getElementById('commentsChart')?.getContext('2d');
      
      if (!viewsCtx || !likesCtx || !commentsCtx) {
        console.error('グラフのキャンバス要素が見つかりません');
        return;
      }
      
      // 再生回数グラフの初期化
      this.viewsChartInstance = new Chart(viewsCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: '再生回数',
            data: [],
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3
          }]
        },
        options: this.getChartOptions('再生回数')
      });
      
      // 高評価グラフの初期化
      this.likesChartInstance = new Chart(likesCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: '高評価数',
            data: [],
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3
          }]
        },
        options: this.getChartOptions('高評価数')
      });
      
      // コメント数グラフの初期化
      this.commentsChartInstance = new Chart(commentsCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'コメント数',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3
          }]
        },
        options: this.getChartOptions('コメント数')
      });
      
      // データをリセット
      this.viewsData = { labels: [], values: [] };
      this.likesData = { labels: [], values: [] };
      this.commentsData = { labels: [], values: [] };
    } catch (error) {
      console.error('Error initializing charts:', error);
      throw new Error('グラフの初期化に失敗しました');
    }
  }
  
  // グラフのオプションを取得
  getChartOptions(title) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: title,
          font: {
            size: 14 // タイトルフォントを小さく
          },
          padding: {
            top: 5,
            bottom: 5
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: 8,
          bodyFont: {
            size: 12
          },
          titleFont: {
            size: 14
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '時間',
            font: {
              size: 12
            }
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 10
            },
            maxRotation: 45,
            minRotation: 45,
            maxTicksLimit: 8 // X軸の目盛り数を制限
          }
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: title,
            font: {
              size: 12
            }
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 10
            },
            callback: function(value) {
              // 大きな数値を省略表示（例：1000 → 1K）
              if (value >= 1000000) {
                return (value / 1000000).toFixed(1) + 'M';
              }
              if (value >= 1000) {
                return (value / 1000).toFixed(1) + 'K';
              }
              return value;
            },
            maxTicksLimit: 8 // Y軸の目盛り数を制限
          },
          // Y軸の自動スケーリングを改善
          adapters: {
            length: 20,
          }
        }
      },
      animation: {
        duration: 500 // アニメーション時間を短縮
      },
      // グラフ全体のパディングを小さく
      layout: {
        padding: {
          left: 5,
          right: 10,
          top: 20,
          bottom: 5
        }
      },
      elements: {
        point: {
          radius: 3, // ポイントを小さく
          hoverRadius: 5
        },
        line: {
          tension: 0.2 // 線の曲がり具合を調整
        }
      }
    };
  }
  
  // グラフを破棄
  destroyCharts() {
    try {
      if (this.viewsChartInstance) {
        this.viewsChartInstance.destroy();
        this.viewsChartInstance = null;
      }
      
      if (this.likesChartInstance) {
        this.likesChartInstance.destroy();
        this.likesChartInstance = null;
      }
      
      if (this.commentsChartInstance) {
        this.commentsChartInstance.destroy();
        this.commentsChartInstance = null;
      }
    } catch (error) {
      console.error('Error destroying charts:', error);
    }
  }
  
  // 統計データでグラフを更新
  updateCharts(stats) {
    try {
      if (!stats) return;
      
      const timeLabel = this.formatTime(new Date(stats.timestamp));
      
      // 再生回数データ更新
      if (this.viewsChartInstance) {
        this.updateChartData(
          this.viewsData,
          this.viewsChartInstance,
          timeLabel,
          stats.viewCount
        );
      }
      
      // 高評価数データ更新
      if (this.likesChartInstance) {
        this.updateChartData(
          this.likesData,
          this.likesChartInstance,
          timeLabel,
          stats.likeCount
        );
      }
      
      // コメント数データ更新
      if (this.commentsChartInstance) {
        this.updateChartData(
          this.commentsData,
          this.commentsChartInstance,
          timeLabel,
          stats.commentCount
        );
      }
    } catch (error) {
      console.error('Error updating charts:', error);
    }
  }
  
  // 特定のチャートデータを更新
  updateChartData(dataSet, chartInstance, label, value) {
    try {
      if (!dataSet || !chartInstance) return;
      
      // データを追加
      dataSet.labels.push(label);
      dataSet.values.push(value);
      
      // データポイントの上限を超えたら古いデータを削除
      if (dataSet.labels.length > this.maxDataPoints) {
        dataSet.labels.shift();
        dataSet.values.shift();
      }
      
      // チャートの更新
      chartInstance.data.labels = dataSet.labels;
      chartInstance.data.datasets[0].data = dataSet.values;
      
      // スケールの更新と調整
      chartInstance.update('none'); // アニメーションなしで更新してパフォーマンス向上
    } catch (error) {
      console.error('Error updating chart data:', error);
    }
  }
  
  // 時間フォーマット (HH:MM:SS)
  formatTime(date) {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  // 現在のデータを取得
  getChartData() {
    return {
      views: [...this.viewsData.values],
      likes: [...this.likesData.values],
      comments: [...this.commentsData.values],
      timestamps: [...this.viewsData.labels]
    };
  }
}
