/**
 * Convert a comma-separated string of 3D vector
 * coordinates into a glMatrix.vec3 object
 * @param {string} s x,y,z string of vector coordinates
 * @return {glMatrix.vec3} Vector version of values
 */
function splitVecStr(s) {
  ret = [];
  s.split(",").forEach(function(x) {
      ret.push(parseFloat(x));
  });
  if (ret.length != 3) {
    alert("Must have 3 comma-separated coordinates in a vector!");
  }
  return glMatrix.vec3.fromValues(ret[0], ret[1], ret[2]);
}

/**
 * Convert an array into a comma-separated
 * list of values
 * @param {list} v List
 * @param {int} k Number of decimal places (default 2)
 */
function vecToStr(v, k) {
  if (k === undefined) {
      k = 2;
  }
  s = "";
  for (let i = 0; i < v.length; i++) {
      s += v[i].toFixed(k);
      if (i < v.length-1) {
          s += ",";
      }
  }
  return s;
}

PLOT_COLORS = {
  "C0":"#0066ff", "C1":"#ff9933", "C2":"#33cc33", "C3":"#cc00ff",
  "C4":"#ff3300", "C5":"#996633"
}; 


/**
 * Return Plotly plots of equal axes that contain a set of vectors
 * @param {list of glMatrix.vec3} vs
 * @return x, y, and z axes plots 
 */
function getAxesEqual(vs) {
  //Determine the axis ranges
  minval = 0;
  maxval = 0;
  for (let i = 0; i < vs.length; i++) {
      for (let j = 0; j < 3; j++) {
          if (vs[i][j] < minval){ minval = vs[i][j]; }
          if (vs[i][j] > maxval){ maxval = vs[i][j]; }
      }
  }
  return {
  x:{ x: [minval, maxval], y: [0, 0], z: [0, 0],
    mode: 'lines', line: {color: '#000000', width: 1}, type: 'scatter3d', name:'xaxis'
  },
  y:{ x: [0, 0], y: [minval, maxval], z: [0, 0],
    mode: 'lines', line: {color: '#000000', width: 1}, type: 'scatter3d', name:'yaxis'
  },
  z:{ x: [0, 0], y: [0, 0], z: [minval, maxval],
    mode: 'lines', line: {color: '#000000', width: 1}, type: 'scatter3d', name:'zaxis'
  }};
}

function getMousePos(canvas, evt) {
  let rect = canvas.getBoundingClientRect();
  return {
      X: evt.clientX - rect.left,
      Y: evt.clientY - rect.top
  };
}

/**
 * Ensure that a set of coordinates sums to 1, while
 * preserving one of them
 * @param {float} a Coordinate to preserve
 * @param {float} b Coordinate 2
 * @param {float} c Coordinate 3
 */
function clampDifference(a, b, c) {
  let diff = a + b + c - 1;
  if (Math.abs(diff) > 0) {
    if (b == 0) {
      c -= diff;
    }
    else if (c == 0) {
      b -= diff;
    }
    else {
      b -= diff/2;
      c -= diff/2;
      if (b < 0) {
        c += b;
        b = 0;
      }
      else if (c < 0) {
        b += c;
        c = 0;
      }
    }
  }
  return {"a":a, "b":b, "c":c};
}

class BarycentricGUI {
  constructor() {
    this.Ps = []; //Points [a, b, c] on the triangle
    this.Qs = []; // Points that have been generated inside
    this.alpha = 0.33;
    this.beta = 0.33;
    this.gamma = 0.34;
    this.setupMenu();
    this.setupCanvas();
  }

  addPoint() {
    if (this.Ps.length == 3) {
      let p = vec3.create();
      vec3.scaleAndAdd(p, p, this.Ps[0], this.alpha);
      vec3.scaleAndAdd(p, p, this.Ps[1], this.beta);
      vec3.scaleAndAdd(p, p, this.Ps[2], this.gamma);
      this.Qs.push(p);
      this.repaint();
    }
    else {
      alert("Must select 3 points on the triangle first");
    }
  }

  setupMenu() {
    let menu = new dat.GUI();
    this.menu = menu;
    this.a = "Not Selected";
    this.b = "Not Selected";
    this.c = "Not Selected";
    let that = this;
    menu.add(this, "a").listen();
    menu.add(this, "b").listen();
    menu.add(this, "c").listen();
    menu.add(this, "alpha", 0, 1).listen().onChange(function() {
      let res = clampDifference(that.alpha, that.beta, that.gamma);
      that.alpha = res.a;
      that.beta = res.b;
      that.gamma = res.c;
      that.addPoint();
    });
    menu.add(this, "beta", 0, 1).listen().onChange(function() {
      let res = clampDifference(that.beta, that.alpha, that.gamma);
      that.alpha = res.b;
      that.beta = res.a;
      that.gamma = res.c;
      that.addPoint();
    });
    menu.add(this, "gamma", 0, 1).listen().onChange(function() {
      let res = clampDifference(that.gamma, that.beta, that.alpha);
      that.alpha = res.c;
      that.beta = res.b;
      that.gamma = res.a;
      that.addPoint();
    });
  }

  /**
   * Setup the 2D canvas for selecting the triangle
   */
  setupCanvas() {
    let canvas = document.getElementById('barycanvas');
    let ctx = canvas.getContext("2d"); //For drawing
    ctx.font = "16px Arial";
    this.canvas = canvas;
    this.ctx = ctx;
    //Need this to disable that annoying menu that pops up on right click
    canvas.addEventListener("contextmenu", function(e){ e.stopPropagation(); e.preventDefault(); return false; }); 
    this.selectingTriangle = true;
    canvas.addEventListener("mousedown", this.selectVec.bind(this));
    canvas.addEventListener("touchstart", this.selectVec.bind(this)); //Works on mobile devices!
    this.repaint(); 
  }

  /**
   * Draw the triangle and the point inside it, as well
   * as the barycentric coordinates at each point
   */
  repaint() {
    let canvas = this.canvas;
    let ctx = this.ctx;
    let Ps = this.Ps;
    let Qs = this.Qs;
    let dW = 5;
    let W = canvas.width;
    let H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    //Draw triangle points
    let vertexNames = ["a", "b", "c"];
    for (let i = 0; i < Ps.length; i++) {
        ctx.fillStyle = PLOT_COLORS["C"+i];
        ctx.fillRect(Ps[i][0]-dW, Ps[i][1]-dW, dW*2+1, dW*2+1);
        ctx.fillText(vertexNames[i], Ps[i][0] + 10, Ps[i][1]);
    }

    //Draw points inside
    ctx.fillStyle = "Black";
    dW = 1;
    for (let i = 0; i < Qs.length; i++) {
      ctx.fillRect(Qs[i][0]-dW, Qs[i][1]-dW, dW*2+1, dW*2+1);
    }
  }

  selectVec(evt) {
      let mousePos = getMousePos(this.canvas, evt);
      let Ps = this.Ps;
      let X = mousePos.X;
      let Y = mousePos.Y
      let clickType = "LEFT";
      evt.preventDefault();
      if (evt.which) {
          if (evt.which == 3) clickType = "RIGHT";
          if (evt.which == 2) clickType = "MIDDLE";
      }
      else if (evt.button) {
          if (evt.button == 2) clickType = "RIGHT";
          if (evt.button == 4) clickType = "MIDDLE";
      }
      
      if (clickType == "LEFT") {
          //Add a point
          if (Ps.length < 3) {
              Ps.push(vec3.fromValues(X, Y, 0));
          }
          else {
              //If there's already a third point, simply replace it
              Ps[2] = vec3.fromValues(X, Y, 0);
          }
      }
      else {
          //Remove point
          if (Ps.length > 0) {
              Ps.pop();
          }
      }
      if (Ps.length < 3) {
        this.Qs = [];
      }
      //Update text describing point coordinates
      for (let i = 0; i < 3; i++) {
          let str = "Not Selected";
          if (i < Ps.length) {
              str = "(" + Ps[i][0].toFixed(0) + "," + Ps[i][1].toFixed(0) + ")";
          }
          if (i == 0) {
            this.a = str;
          }
          else if (i == 1) {
            this.b = str;
          }
          else {
            this.c = str;
          }
      }
      this.repaint();
  }
}




class TriangleDivisionGUI {
  constructor() {
    this.Ps = []; //Points [a, b, c, d]
    this.setupMenu();
    this.setupCanvas();
  }

  setupMenu() {
    let menu = new dat.GUI();
    this.menu = menu;
    this.a = "Not Selected";
    this.b = "Not Selected";
    this.c = "Not Selected";
    this.d = "Not Selected";
    menu.add(this, "a").listen();
    menu.add(this, "b").listen();
    menu.add(this, "c").listen();
    menu.add(this, "d").listen();
  }

  /**
   * Setup the 2D canvas for selecting the triangle
   */
  setupCanvas() {
    let canvas = document.getElementById('barycanvas');
    let ctx = canvas.getContext("2d"); //For drawing
    ctx.font = "16px Arial";
    this.canvas = canvas;
    this.ctx = ctx;
    //Need this to disable that annoying menu that pops up on right click
    canvas.addEventListener("contextmenu", function(e){ e.stopPropagation(); e.preventDefault(); return false; }); 
    canvas.addEventListener("mousedown", this.selectVec.bind(this));
    canvas.addEventListener("touchstart", this.selectVec.bind(this)); //Works on mobile devices!
    this.repaint(); 
  }

  /**
   * Draw the triangle and the point inside it, as well
   * as the barycentric coordinates at each point
   */
  repaint() {
    let canvas = this.canvas;
    let ctx = this.ctx;
    let Ps = this.Ps;
    let Qs = this.Qs;
    let dW = 5;
    let W = canvas.width;
    let H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    //Draw triangle points and point inside
    let vertexNames = ["a", "b", "c", "d"];
    for (let i = 0; i < Ps.length; i++) {
        ctx.fillStyle = PLOT_COLORS["C"+i];
        ctx.fillRect(Ps[i][0]-dW, Ps[i][1]-dW, dW*2+1, dW*2+1);
        ctx.fillText(vertexNames[i], Ps[i][0] + 10, Ps[i][1]);
    }

    // Draw triangle edges
    ctx.fillStyle = "#000000";
    for (let i = 0; i < Ps.length; i++) {
        for (let j = i+1; j < Ps.length; j++) {
          ctx.beginPath();
          ctx.moveTo(Ps[i][0], Ps[i][1]);
          ctx.lineTo(Ps[j][0], Ps[j][1]);
          ctx.stroke();    
        }
    }

    
  }

  selectVec(evt) {
      let mousePos = getMousePos(this.canvas, evt);
      let Ps = this.Ps;
      let X = mousePos.X;
      let Y = mousePos.Y
      let clickType = "LEFT";
      evt.preventDefault();
      if (evt.which) {
          if (evt.which == 3) clickType = "RIGHT";
          if (evt.which == 2) clickType = "MIDDLE";
      }
      else if (evt.button) {
          if (evt.button == 2) clickType = "RIGHT";
          if (evt.button == 4) clickType = "MIDDLE";
      }
      
      if (clickType == "LEFT") {
          //Add a point
          if (Ps.length < 4) {
              Ps.push(vec3.fromValues(X, Y, 0));
          }
          else {
              //If there's already a fourth point, simply replace it
              Ps[3] = vec3.fromValues(X, Y, 0);
          }
      }
      else {
          //Remove point
          if (Ps.length > 0) {
              Ps.pop();
          }
      }
      if (Ps.length < 3) {
        this.Qs = [];
      }
      //Update text describing point coordinates
      for (let i = 0; i < 4; i++) {
          let str = "Not Selected";
          if (i < Ps.length) {
              str = "(" + Ps[i][0].toFixed(0) + "," + Ps[i][1].toFixed(0) + ")";
          }
          if (i == 0) {
            this.a = str;
          }
          else if (i == 1) {
            this.b = str;
          }
          else if (i == 2) {
            this.c = str;
          }
          else {
            this.d = str;
          }
      }
      this.repaint();
  }
}
