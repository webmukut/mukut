
(function($) {
	/*
	 * isystkSlider

	 * Copyright (c) 2013 iseyoshitaka
	 *
	 * Description:
	 *  画像スライダー
	 *
	 * Sample:
	 * var slider1 = $('.js-isystkSlider').isystkSlider({
	 * 	'parentKey': 'ul',
	 * 	'childKey': 'li',
	 * 	'carousel': true,
	 * 	'prevBtnKey': '.back',
	 * 	'nextBtnKey': '.next',
	 * 	'slideCallBack': function(data) {
	 * 		slider1.find('.pageNo').text(data.pageNo + '/' + data.maxPageNo);
	 * 	}
	 * });
	 * slider1.find('.changePage').click(function(e) {
	 * 	e.preventDefault();
	 * 	slider1.changePage($(this).data('pageno'), $.fn.isystkSlider.ANIMATE_TYPE.SLIDE);
	 * });
	 * 
	 */
	$.fn.isystkSlider = function(options) {

		var screen = null // 処理対象エリア
			,	ul = null // 親要素
			,	li = null // 子要素
			,	back = null // 前ページボタン
			,	next = null // 次ページボタン
			,	pos = 0 // 子要素のインデックス
			,	pageNo = 1 // 現在のページ番号
			,	maxPageNo = 1 // 最大のページ番号
			,	liwidth = 0 // 子要素１つの横幅
			,	nowLoading = false // 処理中かどうか
			,	dragw = 0 // スワイプした横幅
			,	childKey = null
			,	shift = null
			,	margin = 0
			,	dispCount = 0
			,	shiftw = 0
			,	animateType = null
			,	slideSpeed = null
			,	carousel = null
			,	slideCallBackFunc = null
			,	resizeCallBackFunc = null
			,	isAutoSlide = null
			,	autoSlideInterval = null
			,	hoverPause = null
			,	isMouseDrag = null
			,	reboundw = null
			,	moment = false
			,	isFullScreen = false
			,	heightMaxScreen = false
			,	diffMoveMode = false; // 通常はページ番号の差分で移動距離を算出しますが、このモードがtrueの場合は間の子要素の数で移動距離を算出します。

		var params = $.extend({}, $.fn.isystkSlider.defaults, options);

		// jQueryオブジェクトキャッシュ、初期設定を行う
		var init = function(obj) {
			screen = $(obj);
			ul = screen.find(params.parentKey);
			li = ul.find(params.childKey);
			back = $(params.prevBtnKey);
			next = $(params.nextBtnKey);
			dispCount = params.dispCount || params.shift;
			childKey = params.childKey;
			animateType = params.animateType;
			isAutoSlide = params.autoSlide;
			autoSlideInterval = params.autoSlideInterval;
			hoverPause = params.hoverPause;
			isMouseDrag = params.isMouseDrag;
			reboundw = params.reboundw;
			moment = params.moment;
			slideSpeed = params.slideSpeed;
			shift = params.shift;
			margin = params.margin;
			carousel = params.carousel;
			isFullScreen = params.isFullScreen;
			heightMaxScreen = params.heightMaxScreen;
			slideCallBackFunc = params.slideCallBack;
			resizeCallBackFunc = params.resizeCallBack;

			ul.find(childKey).each(function(i) {
				$(this).attr('pageno', (i+1));
			});

			if (heightMaxScreen) {
				// 画像縦幅を端末サイズに合わせる為オリジナル画像サイズが必要になる。画像を事前にロードしておく。
				var photos = ul.find(childKey).find('img');
				var photoLength = photos.length;
				photos.each(function() {
					var photo = $(this),
						imagePath = photo.attr('src') || '';
					var img = $('<img>');
					img.on('load',function() {
							photo.attr('owidth', img[0].width);
							photo.attr('oheight', img[0].height);
							if (photoLength !== 1) {
								photoLength--;
								return;
							}
							photos.unbind('load');
							// 画像のロードが完了したらスタート
							exec();
						});
					img.attr('src', imagePath);
				});
			} else {
				exec();
			}

			function exec() {
				if (isFullScreen) {
					// スライド幅＝画面横幅いっぱい
					fullScreen();
				} else if (params.shiftw) {
					// スライド幅＝指定した幅固定
					liwidth = Math.ceil(params.shiftw/shift);
					shiftw = params.shiftw;
				} else {
					// スライド幅＝子要素横幅✕１ページに表示する子要素の数
					liwidth = li.width();
					shiftw = liwidth * shift;
				}
				maxPageNo = Math.ceil(li.length/shift);

				// １ページの場合はスライド不要の為、カルーセルは強制OFFとする。
				if (maxPageNo <= 1) {
					carousel = false;
					isMouseDrag = false;
				}

				if (carousel) {
					// カルーセルの初期設定を行う
					initCarousel();
					pos = (li.length)/2;
				} else {
					// ページングボタンの表示制御
					showArrows();
					pos = shift;
				}

				// ulタグの横幅を調整する
				ul.css('width', shiftw * li.length / shift)
					.css('position', 'relative');

				li.css('float', 'left');

				// 各種イベントの設定
				bindEvent();
				
				// スライダーを設定したよっていうマークを付ける。
				screen.addClass('slider-set-end');
			};
		};

		// 後処理
		var after = function() {
			if (carousel) {
				doCarousel();
			}

			nowLoading = false;
			dragw = 0;
			
			// コールバック
			slideCallBack();
		};

		// 各種イベントの設定
		var bindEvent = function() {

			// スワイプでのページングを可能にする
			if (isMouseDrag) {
				bindMouseDragEvent();
			}

			// ボタンクリックでのページングを可能にする
			bindPagingEvent();

			// 自動でのページングを可能にする
			if (isAutoSlide) {
				autoSlide.init();
			}

		}

		// 指定したページに移動する
		var slide = function(move, animateType) {

			if (!animateType) {
				animateType = ANIMATE_TYPE.NO;
			}

			// 子要素が１つの場合は処理しない
			if (maxPageNo <= 1) {
				after();
				return;
			}

			// カルーセルでない場合は、次ページが存在しないと処理しない
			if (!carousel) {
				if ((move < 0 && pageNo === 1) || (0 < move && pageNo === maxPageNo)) {
					after();
					return;
				}
			}

			nowLoading = true;

			// 現在のオフセット位置と移動後のオフセット位置を設定
			var from = 0;
			if (carousel) {
				from = -1 * (pos/shift) * shiftw - dragw;
			} else {
				from = -1 * (pos-shift)/shift * shiftw - dragw;
			}
			var to = from - (shiftw * move) + dragw;

			// 移動後の子要素のインデックスを設定
			pos = pos + (shift * move);

			// ページ番号を設定
			if (diffMoveMode) {
				if (carousel) {
					pageNo = parseInt($(li[pos]).attr('pageno'));
				} else {
					pageNo = parseInt($(li[(pos-shift)]).attr('pageno'));
				}
			} else {
				pageNo = pageNo + move;
				if (pageNo < 1) {
					pageNo = pageNo + maxPageNo;
				} else if (maxPageNo < pageNo) {
					pageNo = pageNo - maxPageNo;
				}
			}

			// ページングボタンの表示制御
			if (!carousel) {
				showArrows();
			}

			if (animateType === ANIMATE_TYPE.NO) {
				// アニメーションを利用せずに画像を切り替える。
				if (1 < maxPageNo && carousel) {
					ul.css('left', '-' + (pos * liwidth) + 'px');
				} else {
					ul.css('left', '-' + ((pos - shift) * liwidth) + 'px');
				}
				after();
			} else if (animateType === ANIMATE_TYPE.SLIDE) {
				// スライドで画像を切り替える。（Androidで負荷が大きいため、jQueryのアニメーションは利用しない)
				(function() {
					var self = this;

					var elem = ul[0];
					var begin = +new Date();
					var duration = slideSpeed;
					var easing = function(time, duration) {
						return -(time /= duration) * (time - 2);
					};
					var timer = setInterval(function() {
						var time = new Date() - begin;
						var _pos, _now;
						if (time > duration) {
							clearInterval(timer);
							_now = to;
							elem.style.left = _now + 'px';

							after();
							return;
						}
						else {
							_pos = easing(time, duration);
							_now = _pos * (to - from) + from;
						}
						elem.style.left = _now + 'px';
					}, 10);
				})();
			} else if (animateType === ANIMATE_TYPE.FADE) {
				// フェードで画像を切り替える。
				ul.animate({'opacity': 0 }, 300, function() {
					if (1 < maxPageNo && carousel) {
						ul.css('left', '-' + (pos * liwidth) + 'px').animate({'opacity': 1}, 300);
					} else {
						ul.css('left', '-' + ((pos - shift) * liwidth) + 'px').animate({'opacity': 1}, 300);
					}
					after();
				});
			}

		};

		// 次へ、前へボタンの表示・非表示を切り替える
		var showArrows = function() {
			// 1ページしかない場合
			if (maxPageNo <= 1) {
				next.hide();
				back.hide();
			// 左端
			} else if (pageNo === 1) {
				next.show();
				back.hide();
			// 右端
			} else if (pageNo === maxPageNo) {
				back.show();
				next.hide();
			} else {
				back.show();
				next.show();
			}
		};

		// カルーセル用に両端に番兵を作成する
		var initCarousel = function() {

			// 最終ページに空きが出来る場合は空のLIダグを追加する。例）｜○○○｜○○○｜○○○｜○  ｜
			var addSize = li.length%shift;
			if (addSize !== 0) {
				for (var i=0, len=shift-addSize;i<len;i++) {
					ul.append(ul.find(childKey).filter(':first').clone(true).empty().css('width', liwidth).css('height', '1px'));
				}
				// liを再キャッシュ
				li = ul.find(childKey);
			}

			ul
			.append(li.clone(true).addClass('cloned'))
				.css('left', '-' + (liwidth*(li.length)) + 'px');

			// liを再キャッシュ
			li = ul.find(childKey);
		};

		// カルーセル
		var doCarousel = function() {
			// 左端
			if (pos <= 0) {
				pos = (li.length/2);
				ul.css('left', '-' + (liwidth*pos) + 'px');
			// 右端
			} else if ((li.length-shift - (dispCount - shift)) <= pos) {
				var range = pos - (li.length-shift - (dispCount - shift));
				pos = (li.length/2)-shift - (dispCount - shift) + range;
				ul.css('left', '-' + (liwidth*pos) + 'px');
			}
		};

		// ボタンクリックでのページングを可能にする
		var bindPagingEvent = function() {
			// 左方向へスライドする
			back.click(function(e) {
				e.preventDefault();
				backPage();
			});

			// 右方向へスライドする
			next.click(function(e) {
				e.preventDefault();
				nextPage();
			});
		};

		// スワイプでのページングを可能にする
		var bindMouseDragEvent = function() {
			var isTouch = ('ontouchstart' in window);
			// 慣性を利用するかどうか
			var momentObject = (moment) ? new MomentObject(ul[0]) : null;
			ul.bind({
				// タッチの開始、マウスボタンを押したとき
				'touchstart mousedown': function(e) {
					if (nowLoading) {
						event.preventDefault();
						event.stopPropagation();
						return;
					}
					nowLoading = true;

					// 自動スライドのタイマーをリセットする。
					if (autoSlide.on) {
						autoSlide.restart();
					}

					// 開始位置を覚えておく
					this.pageX= ((isTouch && event.changedTouches) ? event.changedTouches[0].pageX : e.pageX);
					this.pageY= ((isTouch && event.changedTouches) ? event.changedTouches[0].pageY : e.pageY);
					this.left = parseInt($(this).css('left'));
					if(isNaN(this.left)) {
						this.left = $(this).position().left;
					}
					this.top = parseInt($(this).css('top'));
					if(isNaN(this.top)) {
						this.top = $(this).position().top;
					}
					this.startLeft = this.left;
					
					this.touched = true;

					// 慣性を利用してスワイプする。
					if (moment) {
						momentObject._position = momentObject.positionize();
						momentObject.dragStart(event);
					}

				},
				// タッチしながら移動、マウスのドラッグ
				'touchmove mousemove': function(e) {

					if (!this.touched) {
						return;
					}

					var x = (this.pageX - ((isTouch && event.changedTouches) ? event.changedTouches[0].pageX : e.pageX));
					var y = (this.pageY - ((isTouch && event.changedTouches) ? event.changedTouches[0].pageY : e.pageY));

					if (Math.abs(x) < 5 || 200 < Math.abs(y)) {
						// スワイプさせない
						return;
					} else {
						// スワイプさせる
						event.preventDefault();
						event.stopPropagation();
					}
					
					if (!carousel) {
						// １ページ目は右にスワイプさせない。
						if (0 < (this.left - x)) {
							return;
						}
						// 最後のページは左にスワイプさせない
						if ((this.left - x) <= -1 * ((maxPageNo-1) * shiftw)) {
							return;
						}
					}

					// 移動先の位置を取得する
					this.left = this.left - x;

					// 慣性を利用する場合は、移動速度を計算する
					if (moment) {
						momentObject.dragMove(event);
					}

					// 画像を移動させる
					$(this).css({left:this.left});

					// 位置 X,Y 座標を覚えておく
					this.pageX = ((isTouch && event.changedTouches) ? event.changedTouches[0].pageX : e.pageX);

				},
				// タッチの終了、マウスのドラッグの終了
				'touchend mouseup touchcancel': function(e) {
					if (!this.touched) {
						return;
					}
					this.touched = false;

					var self = this;
					
					// 残りの移動処理
					var restMove = function (movew) {

						// スワイプ中（touchmove mousemove）で移動したページ量
						var movePage = Math.floor(Math.abs(movew)/shiftw);
						if (movePage != 0) {
							if (movew < 0) {
								movePage = movePage * -1;
							}
							// ページ番号
							pageNo = pageNo + movePage;
							if (pageNo < 1) {
								pageNo = pageNo + maxPageNo;
							} else if (maxPageNo < pageNo) {
								pageNo = pageNo - maxPageNo;
							}
							pos = pos + (shift * movePage);
							if (carousel) {
								// 左端
								if (pos <= 0) {
									pos = (li.length/2);
									ul.css('left', '-' + (liwidth*pos) + 'px');
									pageNo = 1;
									slide(0, ANIMATE_TYPE.NO);
									return;
								// 右端
								} else if ((li.length-shift - (dispCount - shift)) <= pos) {
									var range = pos - (li.length-shift - (dispCount - shift));
									pos = (li.length/2)-shift - (dispCount - shift) + range;
									ul.css('left', '-' + (liwidth*pos) + 'px');
									pageNo = maxPageNo;
									slide(0, ANIMATE_TYPE.NO);
									return;
								}
							}
						}

						var restw = Math.abs(movew) % shiftw;
						if (movew < 0) {
							// 一定幅以上スワイプしていない場合は、跳ね返り処理を行う。
							if ((restw < reboundw) || (!carousel && ((pageNo <= 1 && movew < 0) || (maxPageNo <= pageNo && 0 < dragw)))) {
								var from = self.startLeft - movew;
								var to = self.startLeft - (shiftw * movePage);
								rebound(from, to);
							} else {
								var p = pageNo - 1;
								if (!carousel && p <= 1) {
									p = 1;
								}
								// 前ページ
								dragw = movew - (shiftw * movePage);
								// 移動するページ量
								var move = p - pageNo;
								slide(move, ANIMATE_TYPE.SLIDE);
							}
						} else if (0 < movew) {
							// 一定幅以上スワイプしていない場合は、跳ね返り処理を行う。
							if ((restw < reboundw) || (!carousel && ((pageNo <= 1 && movew < 0) || (maxPageNo <= pageNo && 0 < dragw)))) {
								var from = self.startLeft - movew;
								var to = self.startLeft - (shiftw * movePage);
								rebound(from, to);
							} else {
								var p = pageNo + 1;
								if (!carousel && maxPageNo <= p) {
									p = maxPageNo;
								}
								// 次ページ
								dragw = movew - (shiftw * movePage);
								// 移動するページ量
								var move = p - pageNo;
								slide(move, ANIMATE_TYPE.SLIDE);
							}
						} else {
							// 何もしない
							nowLoading = false;
						}
					}

					// リバウンド処理
					var rebound = function(from, to) {
						var elem = ul[0];
						var begin = +new Date();
						var duration = slideSpeed;
						var easing = function(time, duration) {
							return -(time /= duration) * (time - 2);
						};
						var timer = setInterval(function() {
							var time = new Date() - begin;
							var _pos, _now;
							if (time > duration) {
								clearInterval(timer);
								_now = to;
								elem.style.left = _now + 'px';

								slide(0, ANIMATE_TYPE.NO);
							}
							else {
								_pos = easing(time, duration);
								_now = _pos * (to - from) + from;
							}
							elem.style.left = _now + 'px';
						}, 10);
					}

					if (moment) {
						momentObject.onstop = function (obj) {
					    	// 慣性で動いた分を加算する
							var movew = self.startLeft - self.left + obj.momentw;
							restMove(movew);
					    }
						momentObject.dragEnd(event);
					} else {
						var movew = self.startLeft - self.left;
						restMove(movew);
					}
				    
				}
			});
		};

		// 自動スライド
		var autoSlide = this.autoSlide = new (function() {
			var timer = null;
			this.on = false;
			this.init = function() {
				start();
				if (hoverPause) {
					$(ul).hover(function() {
						stopTimer();
					}, function() {
						startTimer();
					});
				}
			};
			this.restart = function() {
				stopTimer();
				startTimer();
			};
			var start = this.start = function() {
				autoSlide.on = true;
				startTimer();
			};
			function startTimer() {
				if (!autoSlide.on) {
					return;
				}
				timer = setTimeout(function() {
					clearInterval(timer);
					slide(1, animateType);
					startTimer();
				} , autoSlideInterval);
			}
			var stop = this.stop = function() {
				stopTimer();
				autoSlide.on = false;
			};
			function stopTimer() {
				if (!autoSlide.on) {
					return;
				}
				clearInterval(timer);
				timer = null;
			}
		})();

		// 子要素をフルスクリーンで表示します。
		var fullScreen = function() {
			// スライダーの表示幅を調整します。
			var changeDisplay = function() {
				
				// 子要素の横幅を端末のwidthに設定
				ul.find(childKey).width(Math.ceil($(window).width() /dispCount) - Math.ceil(margin/dispCount));
				
				if (heightMaxScreen) {
					ul.find(childKey).height($(window).height());
					ul.find(childKey).each(function() {
						var li = $(this),
							img = li.find('img');

						var x = Math.floor(img.attr('oheight') * $(window).width() / img.attr('owidth'));
						var margin = Math.floor(($(window).height() - x) / 2);
						if (0 <= margin) {
							img.height('').width('100%');
						} else {
							img.height('100%').width('');
						}
						
					});
				}
				
				liwidth = ul.find(childKey).width();
				shiftw = (liwidth + margin) * shift;
				ul.css('width', shiftw * li.length / shift);

				pos = li.length/2;
				ul.css('left', '-' + (liwidth*(li.length)) + 'px');
			};
			var resizeCallBack = function() {
				if (resizeCallBackFunc) {
					var data = {};
					data.pageNo = pageNo;
					data.maxPageNo = maxPageNo;
					if (carousel) {
						data.obj = $(li[pos]);
					} else {
						data.obj = $(li[(pos-shift)]);
					}
					resizeCallBackFunc(data);
				}
			};
			// 画面が回転された場合
			$(this).on('orientationchange',function(){
				changeDisplay();

				// リサイズ時は、コールバックは呼ばない。
				var workPageNo = pageNo;
				var workSlideCallBackFunc = slideCallBackFunc;
				slideCallBackFunc = null;
				pageNo = 1;
				changePage(workPageNo);
				slideCallBackFunc = workSlideCallBackFunc;

				resizeCallBack();
			});
			// 画面がリサイズされた場合
			$(this).resize(function() {
				changeDisplay();

				// リサイズ時は、コールバックは呼ばない。
				var workPageNo = pageNo;
				var workSlideCallBackFunc = slideCallBackFunc;
				slideCallBackFunc = null;
				pageNo = 1;
				changePage(workPageNo);
				slideCallBackFunc = workSlideCallBackFunc;

				resizeCallBack();
			});
			changeDisplay();
		};

		// コールバック
		var slideCallBack = function() {
			if (slideCallBackFunc) {
				var data = {};
				data.pageNo = pageNo;
				data.maxPageNo = maxPageNo;
				if (carousel) {
					data.obj = $(li[pos]);
				} else {
					data.obj = $(li[(pos-shift)]);
				}
				slideCallBackFunc(data);
			}
		};
		

		// 慣性を利用してスライドする
		var MomentObject = function (element) {
			this.element = element;
			this._position = this.positionize();
			this.reset();
		}
		MomentObject.prototype = {
			constructor: MomentObject,
			damping : 15,
			_isDragging: false,
			__position : Vector2.zero,
			_velocity : Vector2.zero,
			_prevTime : 0,
			_prevPosition: Vector2.zero,
			_prevVelocity: Vector2.zero,
			_loopTimer: null,

			positionize: function () {
				var rect = this.element.getBoundingClientRect();
				var x = rect.left;
				var y = rect.top;
				return new Vector2(x, y);
			},

			positionizeByEvent: function (e) {
				var isTouch = ('ontouchstart' in window);
				var x = (isTouch && event.changedTouches) ? event.changedTouches[0].pageX : e.pageX;
				var y = (isTouch && event.changedTouches) ? event.changedTouches[0].pageY : e.pageY;
				return new Vector2(x, y);
			},
			dragStart: function (evt) {
				this.reset();
				this._prevTime	 = Date.now();
				this._prevPosition = this.positionizeByEvent(evt);
				this._isDragging   = true;
			},
			dragMove: function (evt) {
				if (!this._isDragging) {
					return;
				}

				var now = Date.now();
				var deltaTime = now - this._prevTime;
				var eventPos = this.positionizeByEvent(evt);
				var deltaPosition = Vector2.sub(eventPos, this._prevPosition);
				var velocity = Vector2.divisionScalar(deltaPosition, (deltaTime || (deltaTime = 1)));
				var deltaVelocity = Vector2.sub(velocity, this._prevVelocity);

				this._velocity.add(deltaVelocity);
				this._position = Vector2.add(this._position, deltaPosition);

				this._prevTime = now;
				this._prevPosition = eventPos;
				this._prevVelocity = velocity;
			},
			dragEnd: function (evt) {
				this._isDragging = false;
				this.dragRelease();
			},
			dragRelease: function () {
				var _this = this;
				var zero = Vector2.zero;
				var past = Date.now();
				
				var startLeft = _this._position.x;
				
				(function loop() {
					_this.dampingVelocity();
					var now   = Date.now();
					var delta = now - past;
					_this._position = Vector2.add(_this._position, Vector2.multiplyScalar(_this._velocity, delta));
					
					// 画像を移動させる
					$(_this.element).css({left:_this._position.x});

					var isFirst = false;
					if (0 <= _this._position.x) {
						isFirst = true;
					}
					var isLast = false;
					if (_this._position.x <= (-1 * (maxPageNo * (carousel ? 2 : 1) * shiftw) + shiftw)) {
						isLast = true;
					}
					// 先頭に到達、最後に到達、慣性での動作が停止 の何れかの場合
					if (isFirst || isLast || _this._velocity.equal(zero)) {
						_this.reset();

						// 慣性の移動量
						var obj = {
								momentw : startLeft - _this._position.x
						};
						
						_this.stop(obj);
						return;
					}

					past = now;
					_this._loopTimer = setTimeout(loop, 16);
				}());
			},
			dampingVelocity: function () {
				var damping = Vector2.divisionScalar(this._velocity, this.damping);
				this._velocity.sub(damping);
				if (this._velocity.lessThen(0.05)) {
					this._velocity = Vector2.zero;
				}
			},
			reset: function () {
				clearTimeout(this._loopTimer);
				this._velocity = Vector2.zero;
				this._prevVelocity = Vector2.zero;
				this._prevPosition = Vector2.zero;
			},
			
			stop: function (obj) {
				this.onstop && this.onstop(obj);
			}
		};

		// Vector2
		function Vector2(x, y) {
			this.x = x;
			this.y = y;
		}
		Object.defineProperties(Vector2, {
			'zero': {
				enumerable: true,
				set: function (val) {},
				get: function () { return new Vector2(0, 0); }
			}
		});
		Vector2.prototype = {
			constructor: Vector2,

			add: function (vec) {
				this.x += vec.x;
				this.y += vec.y;
				return this;
			},
			sub: function (vec) {
				this.x -= vec.x;
				this.y -= vec.y;
				return this;
			},
			multiplyScalar: function (val) {
				this.x *= val;
				this.y *= val;
				return this;
			},
			divisionScalar: function (val) {
				this.x /= val;
				this.y /= val;
				return this;
			},
			length: function () {
				return Math.sqrt((this.x * this.x) + (this.y * this.y));
			},
			lessThen: function (val) {
				return (this.length() <= val);
			},
			equal: function (vec) {
				return (this.x === vec.x && this.y === vec.y);
			},
			copy: function () {
				return new Vector2(this.x, this.y);
			}
		};
		Vector2.add = function (vec1, vec2) {
			var x = vec1.x + vec2.x;
			var y = vec1.y + vec2.y;
			return new Vector2(x, y);
		};
		Vector2.sub = function (vec1, vec2) {
			var x = vec1.x - vec2.x;
			var y = vec1.y - vec2.y;
			return new Vector2(x, y);
		};
		Vector2.multiplyScalar = function (vec, val) {
			var x = vec.x * val;
			var y = vec.y * val;
			return new Vector2(x, y);
		};
		Vector2.divisionScalar = function (vec, val) {
			var x = vec.x / val;
			var y = vec.y / val;
			return new Vector2(x, y);
		};

		/* Public  */

		// 前ページを表示します。
		var backPage = this.backPage = function(callback) {
			if (nowLoading) {
				return;
			}
			// 自動スライドのタイマーをリセットする。
			if (autoSlide.on) {
				autoSlide.restart();
			}
			slide(-1, animateType);
			if (callback) {
				callback();
			}
		}

		// 次ページを表示します。
		var nextPage = this.nextPage = function(callback) {
			if (nowLoading) {
				return;
			}
			// 自動スライドのタイマーをリセットする。
			if (autoSlide.on) {
				autoSlide.restart();
			}
			slide(1, animateType);
			if (callback) {
				callback();
			}
		}

		// 指定したページを表示します。
		var changePage = this.changePage = function(page, animateType) {
			var page = parseInt(page) || 1;
			if (maxPageNo < page) {
				return;
			}
			// 自動スライドのタイマーをリセットする。
			if (autoSlide.on) {
				autoSlide.restart();
			}
			// 移動するページ量
			var move = 0;
			if (diffMoveMode) {
				if (page !== pageNo) {
					var moveR = (ul.find(params.childKey+'[pageno="'+pageNo+'"]:eq(0)').nextUntil(ul.find(params.childKey+'[pageno="'+page+'"]:eq(0)')).length+1);
					var moveL = -1 * (ul.find(params.childKey+'[pageno="'+page+'"]:eq(0)').nextUntil(ul.find(params.childKey+'[pageno="'+pageNo+'"]:eq(0)')).length+1);
					if (Math.abs(moveR) < Math.abs(moveL)) {
						move = moveR;
					} else {
						move = moveL;
					}
				}
			} else {
				move = page - pageNo;
			}
			slide(move, animateType);
		}

		// 最大ページなどの情報をリフレッシュする。（スライドコールバックで次ページ要素をAjax取得してLIに追加した場合などはこれを利用してページ情報を最新化する）
		// 引数：現在ページ、最大ページ、現在ページの左に追加した要素数
		var refresh = this.refresh = function (page, max, leftAddCnt) {
			// 子要素をリキャッシュ
			li = ul.find(params.childKey);
			if (li.length === 1) {
				// スライド幅＝子要素横幅✕１ページに表示する子要素の数
				liwidth = li.width();
				shiftw = liwidth * shift;
			}
			// 親要素のwidthを再計算
			ul.width(ul.width()+(li.length * liwidth) + 'px');
			if (carousel) {
				diffMoveMode = true;
				if (max) {
					maxPageNo = parseInt(max);
				} else{
					maxPageNo = Math.ceil(li.length/2/shift);
				}
				if (leftAddCnt) {
					pos = pos + leftAddCnt;
					ul.css('left', '-' + (pos * liwidth) + 'px');
				}
				if (page) {
					// コールバックは一次的に呼ばない。
					var workSlideCallBackFunc = slideCallBackFunc;
					slideCallBackFunc = null;
					changePage(page);
					slideCallBackFunc = workSlideCallBackFunc;
				}
			} else {
				if (max) {
					maxPageNo = parseInt(max);
				} else{
					maxPageNo = Math.ceil(li.length/shift);
				}
				showArrows();
			}
		};

		// ボタンクリックやスワイプ時の処理を一次的に停止/開始する。
		var suspend = this.suspend = function(suspendFlg) {
			if (!suspendFlg) {
				nowLoading = false;
			} else {
				nowLoading = true;
			}
		}

		// 処理開始
		$(this).each(function() {
			init(this);
		});

		return this;
	};

	// アニメーションの種類
	var ANIMATE_TYPE = $.fn.isystkSlider.ANIMATE_TYPE = {
		NO: 0,
		SLIDE: 1,
		FADE: 2
	};

	// デフォルト値
	$.fn.isystkSlider.defaults = {
			'parentKey': 'ul' // 親要素
		,	'childKey': 'li' // 子要素
		,	'shift': 1 // １ページでスライドさせる子要素の数
		,	'dispCount': null // １ページに表示する子要素の数(shiftで指定した値と異なる場合にのみ指定する。例：１ページ５要素表示するがスライドは１要素づつ移動する場合など)
		,	'shiftw': null // １ページでにスライドさせる幅(子要素にmarginなどの余白が指定されている場合に、自動で幅が算出できないためこれを指定する。)
		,	'animateType': ANIMATE_TYPE.SLIDE // アニメーションの種類（なし、スライド、フェード）
		,	'slideSpeed': 300 // スライド速度
		,	'carousel': false // １ページ目または、最終ページに到達した場合に、ローテートさせるかどうか
		,	'prevBtnKey': '.prev-btn' // 次ページボタンのセレクタ
		,	'nextBtnKey': '.next-btn' // 前ページボタンのセレクタ
		,	'autoSlide': false // 自動でスライドさせるどうか
		,	'autoSlideInterval':  5000 // 自動でスライドさせる間隔(ミリ秒)
		,	'hoverPause':  false // 子要素上にマウスオーバーすると自動スライドを一時停止する。
		,	'isMouseDrag': false // スワイプでのページングを可能にするかどうか
		,	'reboundw': 50 // スワイプ時に跳ね返りを行う幅
		,	'moment': false // スワイプ時に慣性を利用するかどうか
		,	'isFullScreen': false // 画面横幅いっぱいに画像を表示するかどうか
		,	'margin': 0 // 子要素間のマージン(isFullScreenで画面横幅いっぱいに表示した場合で子要素間にマージンが設定されている場合に利用する)
		,	'heightMaxScreen': false // 画像縦幅が画面縦幅よりも大きい場合は画面縦幅いっぱいに表示する（拡大写真パネルにて利用。isFullScreen がtrueの場合のみ有効）
		,	'slideCallBack': null // スライド後に処理を行うコールバック(本プラグインで想定していない処理はこれを利用してカスタマイズする)
		,	'resizeCallBack': null // 画面リサイズ（または回転）後に処理を行うコールバック
	};

})(jQuery);
