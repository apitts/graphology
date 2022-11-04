/**
 * Graphology Noverlap Layout Webworker
 * =====================================
 *
 * Web worker able to run the layout in a separate thread.
 */
module.exports = function worker() {
  var NODES;

  var moduleShim = {};

  (function () {
    /**
 * Graphology Noverlap Iteration
 * ==============================
 *
 * Function used to perform a single iteration of the algorithm.
 */

/**
 * Matrices properties accessors.
 */
var NODE_X = 0,
  NODE_Y = 1,
  NODE_SIZE = 2;
  NODE_FIXED = 3;
  NODE_HIDDEN = 4;

/**
 * Constants.
 */
var PPN = 5;

/**
 * Helpers.
 */

function jitter() {
  return 0.01 * (0.5 - Math.random());
}

/**
 * Function used to perform a single interation of the algorithm.
 *
 * @param  {object}       options    - Layout options.
 * @param  {Float32Array} NodeMatrix - Node data.
 * @return {object}                  - Some metadata.
 */
moduleShim.exports = function iterate(options, NodeMatrix) {
  // Caching options
  var margin = options.margin;
  var ratio = options.ratio;
  var expansion = options.expansion;
  var gridSize = options.gridSize; // TODO: decrease grid size when few nodes?
  var speed = options.speed;

  // Generic iteration variables
  var i, j, x, y, size, c;
  var converged = true;

  var length = NodeMatrix.length;
  var order = (length / PPN) | 0;

  var deltaX = new Float32Array(order);
  var deltaY = new Float32Array(order);

  // Finding the extents of our space
  var xMin = Infinity;
  var yMin = Infinity;
  var xMax = -Infinity;
  var yMax = -Infinity;

  for (i = 0; i < length; i += PPN) {
    if (NodeMatrix[i + NODE_HIDDEN] !== 1) {
      x = NodeMatrix[i + NODE_X];
      y = NodeMatrix[i + NODE_Y];
      size = NodeMatrix[i + NODE_SIZE] * ratio + margin;

      xMin = Math.min(xMin, x - size);
      xMax = Math.max(xMax, x + size);
      yMin = Math.min(yMin, y - size);
      yMax = Math.max(yMax, y + size);
    } else {
      console.log('Hidden');
    }
  }

  var width = xMax - xMin;
  var height = yMax - yMin;
  var xCenter = (xMin + xMax) / 2;
  var yCenter = (yMin + yMax) / 2;

  xMin = xCenter - (expansion * width) / 2;
  xMax = xCenter + (expansion * width) / 2;
  yMin = yCenter - (expansion * height) / 2;
  yMax = yCenter + (expansion * height) / 2;

  // Building grid
  var grid = {},
    c;

  var col, row;

  for(row = 0; row < gridSize; row++) {
    grid[row] = {};
    for(col = 0; col < gridSize; col++) {
      grid[row][col] = [];
    }
  }

  var nxMin, nxMax, nyMin, nyMax;
  var xMinBox, xMaxBox, yMinBox, yMaxBox;

  for (i = 0; i < length; i += PPN) {
    if(NodeMatrix[i + NODE_HIDDEN] !== 1) {
      x = NodeMatrix[i + NODE_X];
      y = NodeMatrix[i + NODE_Y];
      size = NodeMatrix[i + NODE_SIZE] * ratio + margin;

      nxMin = x - size;
      nxMax = x + size;
      nyMin = y - size;
      nyMax = y + size;

      xMinBox = Math.floor((gridSize * (nxMin - xMin)) / (xMax - xMin));
      xMaxBox = Math.floor((gridSize * (nxMax - xMin)) / (xMax - xMin));
      yMinBox = Math.floor((gridSize * (nyMin - yMin)) / (yMax - yMin));
      yMaxBox = Math.floor((gridSize * (nyMax - yMin)) / (yMax - yMin));

      for (col = xMinBox; col <= xMaxBox; col++) {
        for (row = yMinBox; row <= yMaxBox; row++) {
          grid[row][col].push(i);
        }
      }
    }
  }

  var adjacentNodes = {}; //An object that stores the indexes of adjacent nodes (either in same grid box or adjacent grid box) for all nodes

  var subRow, subCol;

  for(row = 0; row < gridSize; row++) {
    for(col = 0; col < gridSize; col++) {
      grid[row][col].forEach(function(i) {
        if(!adjacentNodes[i]) {
          adjacentNodes[i] = [];
        }
        for(subRow = Math.max(0, row - 1); subRow <= Math.min(row + 1, gridSize - 1); subRow++) {
          for(subCol = Math.max(0, col - 1); subCol <= Math.min(col + 1, gridSize - 1); subCol++) {
            grid[subRow][subCol].forEach(function(j) {
              if(j !== i && adjacentNodes[i].indexOf(j) === -1) {
                adjacentNodes[i].push(j);
              }
            });
          }
        }
      });
    }
  }

  var n1, n2, x1, x2, y1, y2, s1, s2;

  //If two nodes overlap then repulse them
  for (i = 0; i < length; i += PPN) {
    n1 = i
    x1 = NodeMatrix[n1 + NODE_X];
    y1 = NodeMatrix[n1 + NODE_Y];
    s1 = NodeMatrix[n1 + NODE_SIZE];
    adjacentNodes[n1].forEach(function(j) {
      n2 = j
      x2 = NodeMatrix[n2 + NODE_X];
      y2 = NodeMatrix[n2 + NODE_Y];
      s2 = NodeMatrix[n2 + NODE_SIZE];
      xDist = x2 - x1;
      yDist = y2 - y1;
      dist = Math.sqrt(xDist * xDist + yDist * yDist);
      collision = (dist < ((s1 * ratio + margin) + (s2 * ratio + margin)));
      if(collision) {
        converged = false;
        n2 = (n2 / PPN) | 0;
        if (dist > 0) {
          deltaX[n2] += (xDist / dist) * (1 + s1);
          deltaY[n2] += (yDist / dist) * (1 + s1);
        } else {
          // Nodes are on the exact same spot, we need to jitter a bit
          deltaX[n2] += width * jitter();
          deltaY[n2] += height * jitter();
        }
      }
    });
  }

  for (i = 0, j = 0; i < length; i += PPN, j++) {
    if (NodeMatrix[i + NODE_FIXED] !== 1) {
      NodeMatrix[i + NODE_X] += deltaX[j] * 0.1 * speed;
      NodeMatrix[i + NODE_Y] += deltaY[j] * 0.1 * speed;
    }
  }

  return {converged: converged};
};

  })();

  var iterate = moduleShim.exports;

  self.addEventListener('message', function (event) {
    var data = event.data;

    NODES = new Float32Array(data.nodes);

    // Running the iteration
    var result = iterate(data.settings, NODES);

    // Sending result to supervisor
    self.postMessage(
      {
        result: result,
        nodes: NODES.buffer
      },
      [NODES.buffer]
    );
  });
};

