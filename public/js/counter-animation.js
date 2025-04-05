/**
 * YouTubeのようなカウンターアニメーションを実装するクラス
 */
class CounterAnimation {
  /**
   * カウンターアニメーションを初期化
   * @param {HTMLElement} element - アニメーションを表示する要素
   */
  constructor(element) {
    try {
      if (!element) {
        throw new Error('Element is required for CounterAnimation');
      }
      
      this.element = element;
      this.currentValue = 0;
      this.targetValue = 0;
      this.digitContainers = [];
      
      // 初期化
      this.init();
    } catch (error) {
      console.error('Error in CounterAnimation constructor:', error);
      // 初期化に失敗してもクラッシュしないようにする
    }
  }
  
  /**
   * 数値表示要素を初期化する
   */
  init() {
    try {
      // 元の内容をクリア
      this.element.innerHTML = '';
      this.element.classList.add('digit-container');
      
      // 0を表示
      this.updateDisplay(0);
    } catch (error) {
      console.error('Error initializing counter animation:', error);
      
      // エラー時には単純なテキスト表示にフォールバック
      this.element.innerHTML = '0';
      this.element.classList.remove('digit-container');
      this.fallbackMode = true;
    }
  }
  
  /**
   * 数値を更新し、アニメーションを実行
   * @param {number} newValue - 新しい値
   */
  updateValue(newValue) {
    try {
      // 値が同じ場合は何もしない
      if (this.currentValue === newValue) return;
      
      // 不正な値のチェック
      if (isNaN(newValue) || newValue < 0) {
        newValue = 0;
      }
      
      this.targetValue = newValue;
      
      // フォールバックモードの場合は単純なテキスト更新
      if (this.fallbackMode) {
        this.element.textContent = new Intl.NumberFormat('ja-JP').format(newValue);
      } else {
        this.updateDisplay(newValue);
      }
      
      this.currentValue = newValue;
    } catch (error) {
      console.error('Error updating counter value:', error);
      
      // エラー時にはフォールバックモードに切り替え
      this.fallbackMode = true;
      try {
        this.element.textContent = new Intl.NumberFormat('ja-JP').format(newValue);
      } catch (e) {
        this.element.textContent = '表示エラー';
      }
    }
  }
  
  /**
   * カンマ区切りの数値表示を生成
   * @param {number} value - 表示する数値
   */
  updateDisplay(value) {
    try {
      // 現在の内容をクリア
      this.element.innerHTML = '';
      
      // カンマ区切りの文字列に変換
      const formatter = new Intl.NumberFormat('ja-JP');
      const formattedValue = formatter.format(value);
      
      // 各数字・カンマごとに要素を作成
      for (let i = 0; i < formattedValue.length; i++) {
        const char = formattedValue[i];
        
        if (char === ',') {
          // カンマ区切り
          const separatorEl = document.createElement('span');
          separatorEl.className = 'separator';
          separatorEl.textContent = ',';
          this.element.appendChild(separatorEl);
        } else {
          // 数字
          const digitEl = document.createElement('div');
          digitEl.className = 'digit';
          
          // 数字のストリップを作成 (0-9の数字が縦に並んだもの)
          const stripEl = document.createElement('div');
          stripEl.className = 'digit-strip';
          
          // 0~9の数字を作成
          for (let j = 0; j <= 9; j++) {
            const numEl = document.createElement('span');
            numEl.textContent = j;
            stripEl.appendChild(numEl);
          }
          
          // 現在の数字の位置にストリップを移動
          const currentDigit = parseInt(char, 10);
          stripEl.style.transform = `translateY(${-currentDigit * 3}rem)`;
          
          // 要素を追加
          digitEl.appendChild(stripEl);
          this.element.appendChild(digitEl);
        }
      }
    } catch (error) {
      console.error('Error updating display:', error);
      
      // エラー時には単純なテキスト表示にフォールバック
      this.element.innerHTML = formattedValue || '0';
      this.fallbackMode = true;
    }
  }
  
  /**
   * 複数の要素に一括適用するstaticメソッド
   * @param {string} selector - 対象要素のセレクタ
   * @returns {Object} - 初期化されたインスタンスのマップ
   */
  static initAll(selector = '.counter-animation') {
    try {
      const elements = document.querySelectorAll(selector);
      const instances = {};
      
      if (elements.length === 0) {
        console.warn('No counter animation elements found with selector:', selector);
      }
      
      elements.forEach((el, index) => {
        if (!el) return;
        
        const id = el.id || `counter-${index}`;
        try {
          instances[id] = new CounterAnimation(el);
        } catch (error) {
          console.error(`Error initializing counter for ${id}:`, error);
        }
      });
      
      return instances;
    } catch (error) {
      console.error('Error initializing counter animations:', error);
      return {}; // 空のオブジェクトを返して失敗時でもエラーにならないようにする
    }
  }
}
