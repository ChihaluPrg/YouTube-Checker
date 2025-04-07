document.addEventListener('DOMContentLoaded', () => {
  // DOM要素の取得
  const apiKeyForm = document.getElementById('apiKeyForm');
  const apiKeyInput = document.getElementById('apiKey');
  const videoFormContainer = document.getElementById('videoFormContainer');
  const videoForm = document.getElementById('videoForm');
  const videoUrlInput = document.getElementById('videoUrl');
  const videoInfo = document.getElementById('videoInfo');
  const videoTitle = document.getElementById('videoTitle');
  const videoIdDisplay = document.getElementById('videoIdDisplay');
  const thumbnail = document.getElementById('thumbnail');
  const stopTrackingBtn = document.getElementById('stopTracking');
  const statsContainer = document.getElementById('statsContainer');
  const currentViews = document.getElementById('currentViews');
  const currentLikes = document.getElementById('currentLikes');
  const currentComments = document.getElementById('currentComments');
  const errorMessage = document.getElementById('errorMessage');
  const videoListContainer = document.getElementById('videoListContainer');
  const videoList = document.getElementById('videoList');
  const videoItemTemplate = document.getElementById('videoItemTemplate');
  const videoUpdateMode = document.getElementById('videoUpdateMode');
  const exportButtons = document.querySelectorAll('.export-btn');
  
  // 平均値表示要素
  const viewsHourly = document.getElementById('viewsHourly');
  const likesHourly = document.getElementById('likesHourly');
  const commentsHourly = document.getElementById('commentsHourly');
  const viewsDaily = document.getElementById('viewsDaily');
  const likesDaily = document.getElementById('likesDaily');
  const commentsDaily = document.getElementById('commentsDaily');
  const viewsWeekly = document.getElementById('viewsWeekly');
  const likesWeekly = document.getElementById('likesWeekly');
  const commentsWeekly = document.getElementById('commentsWeekly');
  
  // YouTube API関連
  const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
  let API_KEY = localStorage.getItem('youtubeApiKey') || '';
  
  // トラッキング関連
  let trackedVideos = JSON.parse(localStorage.getItem('trackedVideos')) || [];
  let intervalIds = {};
  let currentVideoId = null;
  
  // API使用量制限関連
  const MAX_QUERIES_PER_DAY = 5000000; // APIの1日あたりの最大クエリ数
  const TARGET_USAGE_PERCENT = 90; // 目標使用率 (90% = 4,500,000)
  let apiRequestCount = parseInt(localStorage.getItem('apiRequestCount') || '0');
  let lastCountResetDate = localStorage.getItem('lastCountResetDate') || new Date().toDateString();
  
  // 更新間隔（ミリ秒）- 10秒から30秒に変更してAPI使用量削減
  const UPDATE_INTERVAL = 30000;
  
  // リアルタイム監視モード用の短い更新間隔
  const REALTIME_UPDATE_INTERVAL = 10000;
  
  // 通常モードの更新間隔（クエリ節約）
  const ECONOMY_UPDATE_INTERVAL = 60000; // 1分
  
  // キャッシュ有効期間 (ミリ秒)
  const CACHE_DURATION = 60000; // 1分間
  
  // グラフの最大データポイント数
  const MAX_DATA_POINTS = 20; // グラフ表示用
  
  // 履歴保持の最大データポイント数（増加率計算用に増やす）
  const MAX_HISTORY_POINTS = 2000; // 履歴データ保持用
  
  // カウンターアニメーション
  let counters = null;
  
  // グラフ管理インスタンス
  const charts = new StatsCharts();
  
  // 選択されている更新モード
  let currentUpdateMode = 'normal';
  
  // API使用量制限に関する関数を追加
  function resetApiCounterIfNeeded() {
    const today = new Date().toDateString();
    if (lastCountResetDate !== today) {
      // 日付が変わったらカウンターをリセット
      apiRequestCount = 0;
      lastCountResetDate = today;
      localStorage.setItem('lastCountResetDate', today);
      localStorage.setItem('apiRequestCount', '0');
    }
  }
  
  function incrementApiCounter() {
    resetApiCounterIfNeeded();
    apiRequestCount++;
    localStorage.setItem('apiRequestCount', apiRequestCount.toString());
    
    // API使用量が90%を超えたら警告
    if (apiRequestCount > (MAX_QUERIES_PER_DAY * TARGET_USAGE_PERCENT / 100)) {
      console.warn(`API使用量警告: ${apiRequestCount}/${MAX_QUERIES_PER_DAY} クエリ (${(apiRequestCount/MAX_QUERIES_PER_DAY*100).toFixed(1)}%)`);
      showError(`API使用量が${TARGET_USAGE_PERCENT}%を超えました。更新頻度を下げます。`);
      
      // 更新間隔を長くして使用量を抑制
      adjustUpdateIntervals(true);
    }
  }
  
  // 更新間隔の調整（節約モード切替）
  function adjustUpdateIntervals(economyMode) {
    // 既存のすべての監視を一旦停止
    Object.keys(intervalIds).forEach(videoId => {
      clearInterval(intervalIds[videoId]);
      delete intervalIds[videoId];
    });
    
    // 現在トラッキング中の動画の監視を再開（新しい間隔で）
    trackedVideos.forEach(video => {
      startTracking(video.videoId, economyMode);
    });
  }
  
  // キャッシュ機能
  const apiCache = new Map();
  
  function getCachedData(videoId) {
    if (apiCache.has(videoId)) {
      const cachedItem = apiCache.get(videoId);
      const now = Date.now();
      
      // キャッシュが有効期限内なら使用
      if (now - cachedItem.timestamp < CACHE_DURATION) {
        console.log(`Using cached data for video ${videoId}`);
        return cachedItem.data;
      }
    }
    return null;
  }
  
  function setCachedData(videoId, data) {
    apiCache.set(videoId, {
      data: data,
      timestamp: Date.now()
    });
  }
  
  // ページ初期化
  initPage();
  
  function initPage() {
    try {
      // APIキーの設定確認
      if (API_KEY) {
        apiKeyInput.value = API_KEY;
        videoFormContainer.classList.remove('hidden');
        
        // カウンターアニメーション初期化
        initializeCounters();
        
        // トラッキング中の動画があれば表示
        if (trackedVideos.length > 0) {
          refreshVideoList();
          videoListContainer.classList.remove('hidden');
          
          // 最初の動画を表示
          showVideo(trackedVideos[0].videoId);
          
          // すべての動画の監視を開始
          trackedVideos.forEach(video => {
            startTracking(video.videoId);
          });
        }
      } else {
        // カウンターアニメーション初期化
        initializeCounters();
      }
      
      // API使用量カウンターのリセット確認
      resetApiCounterIfNeeded();
      
      // 更新モード選択のイベントリスナーを追加
      videoUpdateMode.addEventListener('change', handleUpdateModeChange);
      
      // 書き出しボタンのイベントリスナーを追加
      setupExportButtons();
    } catch (error) {
      console.error('Error initializing page:', error);
      showError('ページの初期化中にエラーが発生しました');
    }
  }
  
  // 書き出しボタンのイベントリスナーをセットアップ
  function setupExportButtons() {
    // すべての書き出しボタン要素を取得して再設定
    const exportButtons = document.querySelectorAll('.export-btn');
    console.log('書き出しボタン数:', exportButtons.length);
    
    exportButtons.forEach(button => {
      // 既存のイベントリスナーを削除（重複防止）
      button.removeEventListener('click', handleExportChart);
      
      // 新しいイベントリスナーを追加
      button.addEventListener('click', handleExportChart);
      console.log('書き出しボタンにイベントリスナーを設定:', button.getAttribute('data-chart'));
    });
  }
  
  // カウンターアニメーションの初期化を別関数に分離
  function initializeCounters() {
    try {
      counters = CounterAnimation.initAll();
      
      // カウンターオブジェクトが適切に初期化されたか確認
      if (!counters.currentViews || !counters.currentLikes || !counters.currentComments) {
        // 初期化が不完全な場合は再作成
        counters = {
          currentViews: new CounterAnimation(currentViews),
          currentLikes: new CounterAnimation(currentLikes),
          currentComments: new CounterAnimation(currentComments)
        };
      }
    } catch (error) {
      console.error('Error initializing counters:', error);
      // カウンターが初期化できなくても続行できるようにダミーのオブジェクトを作成
      counters = {
        currentViews: { updateValue: function(val) { currentViews.textContent = formatNumber(val); } },
        currentLikes: { updateValue: function(val) { currentLikes.textContent = formatNumber(val); } },
        currentComments: { updateValue: function(val) { currentComments.textContent = formatNumber(val); } }
      };
    }
  }
  
  // APIキーフォーム送信処理
  apiKeyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // エラーメッセージをクリア
    hideError();
    
    API_KEY = apiKeyInput.value.trim();
    if (!API_KEY) {
      showError('APIキーを入力してください');
      return;
    }
    
    // APIキーをローカルストレージに保存
    localStorage.setItem('youtubeApiKey', API_KEY);
    
    // 動画URL入力フォームを表示
    videoFormContainer.classList.remove('hidden');
  });
  
  // 動画URLフォーム送信処理
  videoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // エラーメッセージをクリア
    hideError();
    
    const input = videoUrlInput.value.trim();
    if (!input) return;
    
    try {
      // 入力から動画IDを取得
      const videoId = extractVideoId(input);
      if (!videoId) {
        showError('有効なYouTube URLまたは動画IDを入力してください');
        return;
      }
      
      // 既に追加済みのチェック - ID比較に変更
      const isAlreadyTracked = trackedVideos.some(v => v.videoId === videoId);
      if (isAlreadyTracked) {
        showError('この動画は既に追加されています');
        return;
      }
      
      // 動画情報を取得して追加
      const videoData = await fetchVideoData(videoId);
      addVideoToTracking(videoData);
      
      // 入力フォームをクリア
      videoUrlInput.value = '';
      
    } catch (error) {
      showError(error.message || 'エラーが発生しました。もう一度お試しください。');
      console.error('Error:', error);
    }
  });
  
  // 監視停止ボタンの処理
  stopTrackingBtn.addEventListener('click', () => {
    if (currentVideoId) {
      removeVideoFromTracking(currentVideoId);
    }
  });
  
  // URLから動画IDを抽出する関数
  function extractVideoId(input) {
    // 直接動画IDの場合
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input;
    }
    
    // YouTube URLからの抽出
    const standardMatch = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?\/]+)/);
    if (standardMatch) {
      return standardMatch[1];
    }
    
    return null;
  }
  
  // YouTube APIから動画情報を取得 - キャッシュと使用量カウンター追加
  async function fetchVideoData(videoId) {
    try {
      if (!videoId || !API_KEY) {
        throw new Error('動画IDまたはAPIキーが設定されていません');
      }
      
      // キャッシュを確認
      const cachedData = getCachedData(videoId);
      if (cachedData) {
        return cachedData;
      }
      
      const url = `${YOUTUBE_API_BASE_URL}/videos?part=snippet,statistics&id=${videoId}&key=${API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      // API使用量をカウント
      incrementApiCounter();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'YouTube APIエラー');
      }
      
      if (!data.items || data.items.length === 0) {
        throw new Error('動画が見つかりません');
      }
      
      const item = data.items[0];
      
      // nullチェックを追加
      const viewCount = parseInt(item.statistics.viewCount || '0', 10);
      const likeCount = parseInt(item.statistics.likeCount || '0', 10);
      const commentCount = parseInt(item.statistics.commentCount || '0', 10);
      
      const result = {
        videoId,
        title: item.snippet.title || 'タイトルなし',
        thumbnail: (item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url),
        viewCount: viewCount,
        likeCount: likeCount,
        commentCount: commentCount,
        timestamp: new Date().toISOString(),
        // 新規追加の場合のみ履歴を初期化
        history: []
      };
      
      // 結果をキャッシュに保存
      setCachedData(videoId, result);
      
      return result;
    } catch (error) {
      console.error('YouTube API error:', error);
      throw error;
    }
  }
  
  // 動画を追跡リストに追加
  function addVideoToTracking(videoData) {
    // 追跡リストに追加
    trackedVideos.push(videoData);
    
    // ローカルストレージに保存
    saveTrackedVideos();
    
    // 動画リストを更新
    refreshVideoList();
    
    // 動画リストコンテナを表示
    videoListContainer.classList.remove('hidden');
    
    // 動画の監視を開始
    startTracking(videoData.videoId);
    
    // 動画情報を表示
    showVideo(videoData.videoId);
  }
  
  // 動画を追跡リストから削除 - 修正
  function removeVideoFromTracking(videoId) {
    // 監視を停止
    stopTracking(videoId);
    
    // リストから削除
    trackedVideos = trackedVideos.filter(v => v.videoId !== videoId);
    
    // ローカルストレージに保存
    saveTrackedVideos();
    
    // 動画リストを更新
    refreshVideoList();
    
    // 他の動画がある場合は最初の動画を表示
    if (trackedVideos.length > 0) {
      showVideo(trackedVideos[0].videoId);
    } else {
      // トラッキング中の動画がない場合は表示要素を隠す
      videoInfo.classList.add('hidden');
      statsContainer.classList.add('hidden');
      videoListContainer.classList.add('hidden');
      currentVideoId = null;
    }
  }
  
  // トラッキングを停止する関数（追加）
  function stopTracking(videoId) {
    if (intervalIds[videoId]) {
      clearInterval(intervalIds[videoId]);
      delete intervalIds[videoId];
    }
  }
  
  // トラッキング中の動画リストを更新
  function refreshVideoList() {
    // リストをクリア
    videoList.innerHTML = '';
    
    // 各動画の要素を追加
    trackedVideos.forEach(video => {
      const template = videoItemTemplate.content.cloneNode(true);
      
      // サムネイルと情報を設定
      const thumbnailImg = template.querySelector('.video-item-thumbnail img');
      thumbnailImg.src = video.thumbnail;
      thumbnailImg.alt = video.title;
      
      template.querySelector('.video-item-title').textContent = video.title;
      template.querySelector('.views').textContent = formatNumber(video.viewCount);
      
      // 表示ボタンにイベントリスナー追加
      const viewBtn = template.querySelector('.view-btn');
      viewBtn.addEventListener('click', () => {
        showVideo(video.videoId);
      });
      
      // 削除ボタンにイベントリスナー追加
      const removeBtn = template.querySelector('.remove-btn');
      removeBtn.addEventListener('click', () => {
        removeVideoFromTracking(video.videoId);
      });
      
      // 現在表示中の動画にはクラスを追加
      if (video.videoId === currentVideoId) {
        template.querySelector('.video-item').classList.add('active');
      }
      
      // リストに追加
      videoList.appendChild(template);
    });
  }
  
  // 特定の動画の情報を表示 - エラーハンドリング改善
  function showVideo(videoId) {
    try {
      // 現在表示中の動画と同じ場合は何もしない
      if (currentVideoId === videoId) return;
      
      // 動画情報を取得
      const video = trackedVideos.find(v => v.videoId === videoId);
      if (!video) {
        console.error('Video not found:', videoId);
        showError('指定された動画が見つかりません');
        return;
      }
      
      // 現在の動画IDを設定
      currentVideoId = videoId;
      
      // 動画情報を表示
      displayVideoInfo(video);
      
      // 動画リストを更新（アクティブ表示のため）
      refreshVideoList();
      
      // 統計データをロード
      loadVideoStats(video);
      
      // 更新モード選択を更新
      updateModeSelectorDisplay(videoId);
      
      // 監視が開始されていなければ開始
      if (!intervalIds[videoId]) {
        startTracking(videoId);
      }
    } catch (error) {
      console.error('Error showing video:', error);
      showError('動画の表示中にエラーが発生しました');
    }
  }
  
  // 動画情報表示 - エラーハンドリング追加
  function displayVideoInfo(videoData) {
    try {
      if (!videoData) {
        console.error('No video data provided to displayVideoInfo');
        return;
      }
      
      videoTitle.textContent = videoData.title || 'タイトルなし';
      videoIdDisplay.textContent = videoData.videoId || '';
      
      // サムネイル画像のエラーハンドリング
      if (videoData.thumbnail) {
        thumbnail.src = videoData.thumbnail;
        thumbnail.alt = videoData.title || 'サムネイル';
        
        // 画像読み込みエラー時のフォールバック
        thumbnail.onerror = function() {
          this.src = 'https://via.placeholder.com/180x101?text=No+Image';
          this.alt = '画像なし';
        };
      } else {
        thumbnail.src = 'https://via.placeholder.com/180x101?text=No+Image';
        thumbnail.alt = '画像なし';
      }
      
      // カウンターアニメーションで統計表示 (エラーハンドリング付き)
      if (counters && typeof counters.currentViews?.updateValue === 'function') {
        counters.currentViews.updateValue(videoData.viewCount || 0);
        counters.currentLikes.updateValue(videoData.likeCount || 0);
        counters.currentComments.updateValue(videoData.commentCount || 0);
      } else {
        // アニメーションが利用できない場合はプレーンテキストで表示
        currentViews.textContent = formatNumber(videoData.viewCount || 0);
        currentLikes.textContent = formatNumber(videoData.likeCount || 0);
        currentComments.textContent = formatNumber(videoData.commentCount || 0);
      }
      
      // 表示領域を表示
      videoInfo.classList.remove('hidden');
      statsContainer.classList.remove('hidden');
    } catch (error) {
      console.error('Error displaying video info:', error);
      // エラーを上位に伝播させて、呼び出し元で処理
      throw new Error('動画情報の表示中にエラーが発生しました');
    }
  }
  
  // 動画監視開始 - 更新間隔を指定可能に
  function startTracking(videoId, economyMode = false, customInterval = null) {
    // 既存の監視を停止
    stopTracking(videoId);
    
    // まず最初の更新を実行
    updateVideoStats(videoId).catch(error => {
      console.error('Error updating stats:', error);
    });
    
    // 更新間隔の決定
    let interval = customInterval || UPDATE_INTERVAL;
    
    // API使用量に基づいて更新間隔を調整
    if (economyMode) {
      interval = ECONOMY_UPDATE_INTERVAL;
      console.log(`Economy mode: Setting update interval to ${interval}ms for video ${videoId}`);
    }
    
    // 選択された更新モードを表示
    updateModeSelectorDisplay(videoId);
    
    // 統計情報を更新
    intervalIds[videoId] = setInterval(async () => {
      try {
        await updateVideoStats(videoId);
      } catch (error) {
        console.error('Error updating stats:', error);
      }
    }, interval);
  }
  
  // 更新モード選択UIを更新
  function updateModeSelectorDisplay(videoId) {
    const video = trackedVideos.find(v => v.videoId === videoId);
    if (!video) return;
    
    // 保存されている更新モードを取得
    const savedMode = video.updateMode || 'normal';
    
    // 更新モード選択を更新
    if (videoUpdateMode) {
      videoUpdateMode.value = savedMode;
      currentUpdateMode = savedMode;
    }
  }
  
  // 動画統計を更新 - 履歴の最適化
  async function updateVideoStats(videoId) {
    // 動画情報を取得
    try {
      const freshData = await fetchVideoData(videoId);
      
      // トラッキングリストから動画を見つける
      const videoIndex = trackedVideos.findIndex(v => v.videoId === videoId);
      if (videoIndex === -1) return;
      
      // 既存の動画なら履歴を引き継ぎ
      if (!freshData.history || freshData.history.length === 0) {
        freshData.history = trackedVideos[videoIndex].history || [];
      }
      
      // 新しい履歴エントリを追加
      freshData.history.push({
        timestamp: freshData.timestamp,
        viewCount: freshData.viewCount,
        likeCount: freshData.likeCount,
        commentCount: freshData.commentCount
      });
      
      // 履歴が長すぎる場合は古いデータを削除
      if (freshData.history.length > MAX_HISTORY_POINTS) {
        freshData.history = freshData.history.slice(-MAX_HISTORY_POINTS);
      }
      
      // 更新モードを保持
      freshData.updateMode = trackedVideos[videoIndex].updateMode || 'normal';
      
      // 更新した動画情報で置き換え
      trackedVideos[videoIndex] = freshData;
      
      // ローカルストレージに保存
      saveTrackedVideos();
      
      // 現在表示中の動画の場合、表示も更新
      if (currentVideoId === videoId) {
        // 統計表示を更新
        if (counters && counters.currentViews) {
          counters.currentViews.updateValue(freshData.viewCount);
          counters.currentLikes.updateValue(freshData.likeCount);
          counters.currentComments.updateValue(freshData.commentCount);
        }
        
        // グラフに新しいデータポイントを追加
        charts.updateCharts(freshData);
        
        // 平均増加率の計算と表示
        calculateAndDisplayAverages(videoId);
      }
      
      // リスト表示も更新
      refreshVideoList();
      
    } catch (error) {
      console.error('Error fetching video stats:', error);
      throw error;
    }
  }
  
  // 動画の統計データをロード - エラーハンドリング改善
  function loadVideoStats(video) {
    try {
      if (!video) {
        console.error('No video data provided to loadVideoStats');
        return;
      }
      
      // グラフをリセット
      try {
        charts.initCharts();
        // グラフ初期化後に書き出しボタンのイベントリスナーを再設定
        setupExportButtons();
      } catch (chartError) {
        console.error('Error initializing charts:', chartError);
        showError('グラフの初期化中にエラーが発生しました');
      }
      
      // 履歴データをロード
      const history = video.history || [];
      
      try {
        // 履歴データがある場合はグラフに追加
        if (history.length > 0) {
          history.forEach(entry => {
            if (!entry) return; // 無効なエントリをスキップ
            
            charts.updateCharts({
              timestamp: entry.timestamp || new Date().toISOString(),
              viewCount: entry.viewCount || 0,
              likeCount: entry.likeCount || 0,
              commentCount: entry.commentCount || 0
            });
          });
        }
      } catch (chartUpdateError) {
        console.error('Error updating charts with history data:', chartUpdateError);
      }
      
      try {
        // 最新データの表示
        if (counters && typeof counters.currentViews?.updateValue === 'function') {
          counters.currentViews.updateValue(video.viewCount || 0);
          counters.currentLikes.updateValue(video.likeCount || 0);
          counters.currentComments.updateValue(video.commentCount || 0);
        } else {
          // カウンターが利用できない場合はプレーンテキストで表示
          currentViews.textContent = formatNumber(video.viewCount || 0);
          currentLikes.textContent = formatNumber(video.likeCount || 0);
          currentComments.textContent = formatNumber(video.commentCount || 0);
        }
      } catch (counterError) {
        console.error('Error updating counters:', counterError);
        
        // エラー時は通常のテキストで表示
        currentViews.textContent = formatNumber(video.viewCount || 0);
        currentLikes.textContent = formatNumber(video.likeCount || 0);
        currentComments.textContent = formatNumber(video.commentCount || 0);
      }
      
      // 平均増加率の計算と表示
      try {
        calculateAndDisplayAverages(video.videoId);
      } catch (avgError) {
        console.error('Error calculating averages:', avgError);
        resetAverageDisplay();
      }
    } catch (error) {
      console.error('Error loading video stats:', error);
      showError('統計データの読み込み中にエラーが発生しました');
    }
  }
  
  // 平均増加率の計算と表示
  function calculateAndDisplayAverages(videoId) {
    const video = trackedVideos.find(v => v.videoId === videoId);
    if (!video || !video.history || video.history.length < 2) {
      // データが不足している場合
      resetAverageDisplay();
      return;
    }
    
    // 履歴を日時でソート
    const history = [...video.history].sort((a, b) => {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
    
    const latest = history[history.length - 1];
    const now = new Date(latest.timestamp);
    
    console.log(`計算: 最新データ時間 ${now.toLocaleString()}`);
    console.log(`計算: 履歴データ数 ${history.length}件`);
    
    // 1時間前のデータを検索
    const oneHourAgo = new Date(now);
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    // 24時間前のデータを検索
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    // 1週間前のデータを検索
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // 最も古いエントリの時間
    const oldestEntryTime = new Date(history[0].timestamp);
    console.log(`計算: 最古のデータ時間 ${oldestEntryTime.toLocaleString()}`);
    
    // 1時間の増加率 (1時間以上のデータがある場合)
    const hourlyDiff = now - oneHourAgo;
    console.log(`計算: 1時間前 = ${oneHourAgo.toLocaleString()}, 差分 ${Math.round(hourlyDiff / (1000 * 60))}分`);
    
    // 最も新しいデータから見て1時間以上のデータがあるか
    if (oldestEntryTime <= oneHourAgo) {
      const hourlyData = findBestDataPointBefore(history, oneHourAgo);
      if (hourlyData) {
        console.log(`計算: 1時間前のデータ ${new Date(hourlyData.timestamp).toLocaleString()}`);
        
        const viewsDiff = latest.viewCount - hourlyData.viewCount;
        const likesDiff = latest.likeCount - hourlyData.likeCount;
        const commentsDiff = latest.commentCount - hourlyData.commentCount;
        
        viewsHourly.textContent = formatChangeRate(viewsDiff);
        likesHourly.textContent = formatChangeRate(likesDiff);
        commentsHourly.textContent = formatChangeRate(commentsDiff);
      } else {
        resetHourlyAverages();
      }
    } else {
      // 十分なデータがない場合
      resetHourlyAverages();
    }
    
    // 日次増加率 (24時間以内のデータがある場合)
    const dailyDiff = now - oneDayAgo;
    console.log(`計算: 24時間前 = ${oneDayAgo.toLocaleString()}, 差分 ${Math.round(dailyDiff / (1000 * 60 * 60))}時間`);
    
    if (oldestEntryTime <= oneDayAgo) {
      const dailyData = findBestDataPointBefore(history, oneDayAgo);
      if (dailyData) {
        console.log(`計算: 24時間前のデータ ${new Date(dailyData.timestamp).toLocaleString()}`);
        
        const viewsDiff = latest.viewCount - dailyData.viewCount;
        const likesDiff = latest.likeCount - dailyData.likeCount;
        const commentsDiff = latest.commentCount - dailyData.commentCount;
        
        viewsDaily.textContent = formatChangeRate(viewsDiff);
        likesDaily.textContent = formatChangeRate(likesDiff);
        commentsDaily.textContent = formatChangeRate(commentsDiff);
      } else {
        resetDailyAverages();
      }
    } else {
      // 十分なデータがない場合
      resetDailyAverages();
    }
    
    // 週間増加率 (1週間以内のデータがある場合)
    const weeklyDiff = now - oneWeekAgo;
    console.log(`計算: 1週間前 = ${oneWeekAgo.toLocaleString()}, 差分 ${Math.round(weeklyDiff / (1000 * 60 * 60 * 24))}日`);
    
    if (oldestEntryTime <= oneWeekAgo) {
      const weeklyData = findBestDataPointBefore(history, oneWeekAgo);
      if (weeklyData) {
        console.log(`計算: 1週間前のデータ ${new Date(weeklyData.timestamp).toLocaleString()}`);
        
        const viewsDiff = latest.viewCount - weeklyData.viewCount;
        const likesDiff = latest.likeCount - weeklyData.likeCount;
        const commentsDiff = latest.commentCount - weeklyData.commentCount;
        
        viewsWeekly.textContent = formatChangeRate(viewsDiff);
        likesWeekly.textContent = formatChangeRate(likesDiff);
        commentsWeekly.textContent = formatChangeRate(commentsDiff);
      } else {
        resetWeeklyAverages();
      }
    } else {
      // 十分なデータがない場合
      resetWeeklyAverages();
    }
  }
  
  // 指定時間より前の最も新しいデータポイントを見つける (改善版)
  function findBestDataPointBefore(history, targetDate) {
    // 指定時間以前のデータポイントをフィルタリング
    const olderPoints = history.filter(entry => new Date(entry.timestamp) <= targetDate);
    
    if (olderPoints.length === 0) {
      return null;
    }
    
    // 指定時間以前で最も新しいデータポイントを返す
    return olderPoints.reduce((newest, current) => {
      const currentTime = new Date(current.timestamp);
      const newestTime = new Date(newest.timestamp);
      return currentTime > newestTime ? current : newest;
    }, olderPoints[0]);
  }
  
  // 数値の変化率のフォーマット（正の値には「+」を追加）
  function formatChangeRate(value) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${formatNumber(value)}`;
  }
  
  // 1時間平均表示をリセット
  function resetHourlyAverages() {
    viewsHourly.textContent = '-';
    likesHourly.textContent = '-';
    commentsHourly.textContent = '-';
  }
  
  // 日次平均表示をリセット
  function resetDailyAverages() {
    viewsDaily.textContent = '-';
    likesDaily.textContent = '-';
    commentsDaily.textContent = '-';
  }
  
  // 週間平均表示をリセット
  function resetWeeklyAverages() {
    viewsWeekly.textContent = '-';
    likesWeekly.textContent = '-';
    commentsWeekly.textContent = '-';
  }
  
  // 全ての平均表示をリセット
  function resetAverageDisplay() {
    resetHourlyAverages();
    resetDailyAverages();
    resetWeeklyAverages();
  }
  
  // トラッキング中の動画をローカルストレージに保存
  function saveTrackedVideos() {
    try {
      localStorage.setItem('trackedVideos', JSON.stringify(trackedVideos));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      showError('データの保存中にエラーが発生しました');
    }
  }
  
  // エラー表示
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    
    // 5秒後に自動で消える
    setTimeout(() => {
      hideError();
    }, 5000);
  }
  
  // エラー非表示
  function hideError() {
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
  }
  
  // 数値のフォーマット
  function formatNumber(num) {
    return new Intl.NumberFormat('ja-JP').format(num);
  }
  
  // 更新モード変更処理
  function handleUpdateModeChange(e) {
    if (!currentVideoId) return;
    
    const mode = e.target.value;
    currentUpdateMode = mode;
    console.log(`Changing update mode to ${mode} for video ${currentVideoId}`);
    
    // 動画の更新間隔を変更
    switch(mode) {
      case 'realtime':
        startTracking(currentVideoId, false, REALTIME_UPDATE_INTERVAL);
        break;
      case 'economy':
        startTracking(currentVideoId, true, ECONOMY_UPDATE_INTERVAL);
        break;
      case 'normal':
      default:
        startTracking(currentVideoId, false, UPDATE_INTERVAL);
        break;
    }
    
    // 動画のメタデータに更新モードを保存
    const videoIndex = trackedVideos.findIndex(v => v.videoId === currentVideoId);
    if (videoIndex !== -1) {
      trackedVideos[videoIndex].updateMode = mode;
      saveTrackedVideos();
    }
  }
  
  // グラフ書き出し処理
  function handleExportChart(e) {
    console.log('書き出しボタンがクリックされました');
    const chartType = e.target.getAttribute('data-chart');
    console.log('グラフタイプ:', chartType);
    
    if (!chartType || !currentVideoId) {
      console.error('グラフタイプまたは動画IDが見つかりません');
      return;
    }
    
    // 現在表示中の動画情報を取得
    const video = trackedVideos.find(v => v.videoId === currentVideoId);
    if (!video) return;
    
    // 1ヶ月表示のデータを準備
    const monthlyData = prepareMonthlyData(video.history, chartType);
    
    // 書き出しダイアログ生成
    createExportDialog(charts[`${chartType}ChartInstance`], monthlyData, chartType, video.title);
  }
  
  // 書き出しダイアログを作成
  function createExportDialog(chartInstance, monthlyData, chartType, videoTitle) {
    // 既存のダイアログがあれば削除
    const existingDialog = document.querySelector('.export-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // ダイアログ要素を作成
    const dialog = document.createElement('div');
    dialog.className = 'export-dialog';
    
    // ダイアログコンテンツ
    dialog.innerHTML = `
      <div class="export-dialog-content">
        <h3>${getChartTitle(chartType)}の書き出し</h3>
        <div class="export-options">
          <label>
            <input type="radio" name="export-period" value="current" checked> 現在の表示
          </label>
          <label>
            <input type="radio" name="export-period" value="month"> 1ヶ月間のデータ
          </label>
        </div>
        <div class="export-preview"></div>
        <div class="export-dialog-buttons">
          <button class="cancel-btn small-btn">キャンセル</button>
          <button class="download-btn small-btn">ダウンロード</button>
        </div>
      </div>
    `;
    
    // ダイアログをページに追加
    document.body.appendChild(dialog);
    
    // プレビュー要素
    const previewContainer = dialog.querySelector('.export-preview');
    
    // 現在のグラフをプレビューとして表示
    const currentImage = chartInstance.toBase64Image();
    const previewImg = document.createElement('img');
    previewImg.src = currentImage;
    previewContainer.appendChild(previewImg);
    
    // オプション切り替え
    const periodOptions = dialog.querySelectorAll('input[name="export-period"]');
    periodOptions.forEach(option => {
      option.addEventListener('change', (e) => {
        if (e.target.value === 'current') {
          // 現在の表示をプレビュー
          previewImg.src = chartInstance.toBase64Image();
        } else if (e.target.value === 'month') {
          // 1ヶ月データのグラフをプレビュー
          const monthlyChartImage = generateMonthlyChart(monthlyData, chartType, videoTitle);
          previewImg.src = monthlyChartImage;
        }
      });
    });
    
    // キャンセルボタン
    const cancelBtn = dialog.querySelector('.cancel-btn');
    cancelBtn.addEventListener('click', () => {
      dialog.remove();
    });
    
    // ダウンロードボタン
    const downloadBtn = dialog.querySelector('.download-btn');
    downloadBtn.addEventListener('click', () => {
      // 選択された期間のオプションを取得
      const selectedPeriod = dialog.querySelector('input[name="export-period"]:checked').value;
      let imageUrl;
      
      if (selectedPeriod === 'current') {
        imageUrl = chartInstance.toBase64Image();
      } else if (selectedPeriod === 'month') {
        imageUrl = generateMonthlyChart(monthlyData, chartType, videoTitle);
      }
      
      // 画像をダウンロード
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `${videoTitle}-${getChartTitle(chartType)}-${timestamp}.png`;
      link.href = imageUrl;
      link.click();
      
      // ダイアログを閉じる
      dialog.remove();
    });
    
    // 背景クリックでダイアログを閉じる
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });
  }
  
  // 1ヶ月間のデータを準備
  function prepareMonthlyData(history, chartType) {
    if (!history || history.length < 2) return null;
    
    // 最新のデータから30日前まで
    const latest = history[history.length - 1];
    const latestDate = new Date(latest.timestamp);
    const thirtyDaysAgo = new Date(latestDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // 日付ごとにデータをグループ化
    const dailyData = {};
    
    history.forEach(entry => {
      const entryDate = new Date(entry.timestamp);
      
      // 30日以内のデータのみ処理
      if (entryDate >= thirtyDaysAgo) {
        // 日付ごとのキーを作成 (YYYY-MM-DD)
        const dateKey = entryDate.toISOString().split('T')[0];
        
        // 日付ごとのデータを集計
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            date: dateKey,
            viewCount: entry.viewCount,
            likeCount: entry.likeCount,
            commentCount: entry.commentCount,
            count: 1
          };
        } else {
          // その日に複数のデータポイントがある場合は最新のものを使用
          if (new Date(entry.timestamp) > new Date(dailyData[dateKey].timestamp || 0)) {
            dailyData[dateKey].viewCount = entry.viewCount;
            dailyData[dateKey].likeCount = entry.likeCount;
            dailyData[dateKey].commentCount = entry.commentCount;
            dailyData[dateKey].timestamp = entry.timestamp;
          }
        }
      }
    });
    
    // 日付でソートした配列に変換
    const sortedData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    
    return sortedData;
  }
  
  // 1ヶ月表示のグラフを生成
  function generateMonthlyChart(monthlyData, chartType, videoTitle) {
    if (!monthlyData || monthlyData.length === 0) {
      showError('1ヶ月分のデータがありません');
      return null;
    }
    
    // データを取得
    const dates = monthlyData.map(d => formatDate(d.date));
    let values;
    let chartTitle;
    let color;
    
    switch(chartType) {
      case 'views':
        values = monthlyData.map(d => d.viewCount);
        chartTitle = '再生回数の月間推移';
        color = 'rgb(255, 99, 132)';
        break;
      case 'likes':
        values = monthlyData.map(d => d.likeCount);
        chartTitle = '高評価数の月間推移';
        color = 'rgb(54, 162, 235)';
        break;
      case 'comments':
        values = monthlyData.map(d => d.commentCount);
        chartTitle = 'コメント数の月間推移';
        color = 'rgb(75, 192, 192)';
        break;
      default:
        return null;
    }
    
    // 一時的なキャンバスを作成
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 800;
    tempCanvas.height = 400;
    document.body.appendChild(tempCanvas);
    
    // グラフを描画
    const ctx = tempCanvas.getContext('2d');
    const monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: chartTitle,
          data: values,
          borderColor: color,
          backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: `${videoTitle} - ${chartTitle}`,
            font: {
              size: 16
            }
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: '日付'
            }
          },
          y: {
            title: {
              display: true,
              text: getChartTitle(chartType)
            },
            beginAtZero: false
          }
        }
      }
    });
    
    // グラフの画像を生成
    const image = monthlyChart.toBase64Image();
    
    // 一時キャンバスを削除
    monthlyChart.destroy();
    document.body.removeChild(tempCanvas);
    
    return image;
  }
  
  // 日付のフォーマット (YYYY-MM-DD -> MM/DD)
  function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  
  // グラフタイトルを取得
  function getChartTitle(chartType) {
    switch(chartType) {
      case 'views': return '再生回数';
      case 'likes': return '高評価数';
      case 'comments': return 'コメント数';
      default: return '';
    }
  }
});
