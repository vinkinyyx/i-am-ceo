/**
 * 自有启动首屏（替换 Cocos 默认 first-screen）。
 *
 * 设计：仅铺无字背景艺术层（cover），真实进度由本文件单独绘制。
 *
 * 健壮性原则（真机曾出现卡首屏）：
 * - 任何异常/不支持 WebGL/图片加载失败都不 reject，直接放行给引擎；
 * - 进度 Promise 带超时兜底，避免引擎启动链永久挂起。
 */
(function () {
  var IMG_W = 1080;
  var IMG_H = 2400;
  var BAR_LEFT = 160;
  var BAR_RIGHT = 920;
  var BAR_CY = -0.82; // 进度条中心（归一化 y，负值靠底部）
  var BAR_HH = 0.016; // 进度条半高（归一化）
  var BAR_FILL = [0.18, 0.84, 0.64, 1];
  var BAR_TRACK = [0.79, 0.86, 0.94, 1];
  var BG_COLOR = [0.94, 0.96, 0.99, 1];
  var BG_NAME = 'splash-art.png';

  var VS_TEX =
    'attribute vec4 a_Position;attribute vec2 a_TexCoord;varying vec2 v_TexCoord;' +
    'void main(){gl_Position=a_Position;v_TexCoord=a_TexCoord;}';
  var FS_TEX =
    'precision mediump float;uniform sampler2D u_Sampler;varying vec2 v_TexCoord;' +
    'void main(){gl_FragColor=texture2D(u_Sampler,v_TexCoord);}';
  var VS_COLOR = 'attribute vec4 a_Position;void main(){gl_Position=a_Position;}';
  var FS_COLOR = 'precision mediump float;uniform vec4 u_Color;void main(){gl_FragColor=u_Color;}';

  var canvas = null;
  var gl = null;
  var texProgram = null;
  var colorProgram = null;
  var quadBuffer = null;
  var texBuffer = null;
  var bgTex = null;
  var bgImage = null;
  var progress = 0;
  var rafHandle = null;
  var afterTick = null;
  var running = false;

  function getCanvas() {
    try {
      if (typeof window !== 'undefined' && window.canvas) return window.canvas;
    } catch (e) {
      // ignore
    }
    try {
      if (typeof GameGlobal !== 'undefined' && GameGlobal.canvas) return GameGlobal.canvas;
    } catch (e) {
      // ignore
    }
    try {
      if (typeof document !== 'undefined' && document.getElementById) {
        return document.getElementById('GameCanvas');
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /** 兼容容器未挂全局 raf 的情况（华为/vivo 上 GameGlobal.raf 可能缺失）。 */
  function nextFrame(cb) {
    try {
      if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
    } catch (e) {
      // ignore
    }
    return setTimeout(cb, 16);
  }

  function cancelFrame(handle) {
    try {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
    } catch (e) {
      // ignore
    }
  }

  function compile(type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      try {
        console.warn('[splash] shader:', gl.getShaderInfoLog(shader));
      } catch (e) {
        // ignore
      }
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function makeProgram(vsSrc, fsSrc) {
    var vs = compile(gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    var ok = false;
    try {
      ok = gl.getProgramParameter(p, gl.LINK_STATUS);
    } catch (e) {
      ok = false;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!ok) {
      try {
        console.warn('[splash] link:', gl.getProgramInfoLog(p));
      } catch (e) {
        // ignore
      }
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  function init() {
    canvas = getCanvas();
    if (!canvas) return false;
    try {
      gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: true,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      });
    } catch (e) {
      gl = null;
    }
    if (!gl) return false;
    texProgram = makeProgram(VS_TEX, FS_TEX);
    colorProgram = makeProgram(VS_COLOR, FS_COLOR);
    if (!texProgram || !colorProgram) return false;
    quadBuffer = gl.createBuffer();
    texBuffer = gl.createBuffer();
    return true;
  }

  function loadBackground() {
    try {
      bgImage = new Image();
      bgImage.premultiplyAlpha = false;
      bgImage.onload = function () {
        try {
          bgTex = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, bgTex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgImage);
        } catch (e) {
          bgTex = null;
        }
      };
      bgImage.onerror = function () {
        bgImage = null;
      };
      bgImage.src = BG_NAME;
    } catch (e) {
      bgImage = null;
    }
  }

  /** 图片按高度铺满（cover）：宽度可能超出或被裁，进度条宽度随之换算。 */
  function barHalfWidth() {
    try {
      if (bgImage && bgImage.width) {
        var scale = canvas.height / IMG_H;
        var w = (BAR_RIGHT - BAR_LEFT) * scale / canvas.width;
        return Math.min(0.98, Math.max(0.2, w));
      }
    } catch (e) {
      // ignore
    }
    return 0.67;
  }

  function drawBackground() {
    if (!bgImage || !bgTex) return false;
    var scale = canvas.height / IMG_H;
    var halfW = (IMG_W * scale) / canvas.width;
    gl.useProgram(texProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.uniform1i(gl.getUniformLocation(texProgram, 'u_Sampler'), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -halfW, -1, 0, 0,
        -halfW, 1, 0, 1,
        halfW, -1, 1, 0,
        halfW, 1, 1, 1,
      ]),
      gl.DYNAMIC_DRAW,
    );
    var aPos = gl.getAttribLocation(texProgram, 'a_Position');
    var aUv = gl.getAttribLocation(texProgram, 'a_TexCoord');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  function drawQuad(x0, x1, y0, y1, color) {
    gl.useProgram(colorProgram);
    gl.uniform4fv(gl.getUniformLocation(colorProgram, 'u_Color'), color);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([x0, y0, x0, y1, x1, y0, x1, y1]),
      gl.DYNAMIC_DRAW,
    );
    var aPos = gl.getAttribLocation(colorProgram, 'a_Position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 8, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function draw() {
    if (!gl || !canvas || !canvas.width || !canvas.height) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawBackground();
    var hw = barHalfWidth();
    var cy = BAR_CY;
    var hh = BAR_HH;
    drawQuad(-hw, hw, cy - hh, cy + hh, BAR_TRACK);
    if (progress > 0) {
      var edge = -hw + 2 * hw * (progress > 1 ? 1 : progress);
      drawQuad(-hw, edge, cy - hh, cy + hh, BAR_FILL);
    }
  }

  function tick() {
    if (!running) return;
    rafHandle = nextFrame(function () {
      try {
        draw();
      } catch (e) {
        try {
          console.warn('[splash] draw:', e);
        } catch (e2) {
          // ignore
        }
      }
      tick();
      if (afterTick) {
        var cb = afterTick;
        afterTick = null;
        try {
          cb();
        } catch (e) {
          // ignore
        }
      }
    });
  }

  function start() {
    try {
      if (!init()) {
        // 不支持 WebGL：直接交给引擎，绝不让启动链挂起
        return Promise.resolve();
      }
      running = true;
      tick();
      loadBackground();
    } catch (e) {
      try {
        console.warn('[splash] start:', e);
      } catch (e2) {
        // ignore
      }
    }
    return Promise.resolve();
  }

  function setProgress(val) {
    progress = Math.max(0, Math.min(1, Number(val) || 0));
    return new Promise(function (resolve) {
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      afterTick = done;
      setTimeout(done, 600); // 兜底：即使动画帧停了也要放行
    });
  }

  function end() {
    return setProgress(1).then(function () {
      try {
        running = false;
        if (rafHandle) cancelFrame(rafHandle);
        rafHandle = null;
        if (bgTex) gl.deleteTexture(bgTex);
        if (texProgram) gl.deleteProgram(texProgram);
        if (colorProgram) gl.deleteProgram(colorProgram);
        if (quadBuffer) gl.deleteBuffer(quadBuffer);
        if (texBuffer) gl.deleteBuffer(texBuffer);
        texProgram = null;
        colorProgram = null;
        bgTex = null;
      } catch (e) {
        // ignore：释放失败不影响引擎接管 canvas
      }
    });
  }

  module.exports = {
    start: start,
    end: end,
    setProgress: setProgress,
  };
})();
