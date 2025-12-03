// Three.js 3D Scatter Plot for Loan Data
let scene, camera, renderer, points, raycaster, mouse;
let controls = { autoRotate: false };
const tooltip = document.getElementById('tooltip');

// Initialize Three.js scene
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(300, 200, 300);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('container').appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight.position.set(100, 100, 100);
  scene.add(directionalLight);

  // Raycaster for hover detection
  raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 2;
  mouse = new THREE.Vector2();

  // Load data and create visualization
  loadData();

  // Mouse controls
  setupControls();

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
  
  // Mouse move for tooltip
  renderer.domElement.addEventListener('mousemove', onMouseMove, false);

  animate();
}

function setupControls() {
  let isDragging = false;
  let isPanning = false;
  let previousMousePosition = { x: 0, y: 0 };

  renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0) isDragging = true;
    if (e.button === 2) isPanning = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  renderer.domElement.addEventListener('mouseup', () => {
    isDragging = false;
    isPanning = false;
  });

  renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      const rotationSpeed = 0.005;
      
      // Rotate around the Y axis
      const yAxis = new THREE.Vector3(0, 1, 0);
      camera.position.applyAxisAngle(yAxis, -deltaX * rotationSpeed);
      
      // Rotate around the X axis (camera's right vector)
      const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      camera.position.applyAxisAngle(xAxis, -deltaY * rotationSpeed);
      
      camera.lookAt(0, 0, 0);
    }

    if (isPanning) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      const panSpeed = 0.5;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

      camera.position.addScaledVector(right, -deltaX * panSpeed);
      camera.position.addScaledVector(up, deltaY * panSpeed);
    }

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    camera.position.addScaledVector(direction, e.deltaY * zoomSpeed);
  });

  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  
  if (points) {
    const intersects = raycaster.intersectObject(points);
    
    if (intersects.length > 0) {
      const point = intersects[0];
      const data = point.object.userData[point.index];
      
      if (data) {
        tooltip.style.display = 'block';
        tooltip.style.left = event.clientX + 15 + 'px';
        tooltip.style.top = event.clientY + 15 + 'px';
        tooltip.innerHTML = `
          <strong>ID:</strong> ${data.customer_id}<br>
          <strong>Income:</strong> $${d3.format(",")(data.annual_income)}<br>
          <strong>Credit Score:</strong> ${data.credit_score}<br>
          <strong>Debt-to-Income:</strong> ${data.debt_to_income_ratio.toFixed(2)}<br>
          <strong>Status:</strong> ${data.loan_status === 1 ? 'Approved' : 'Rejected'}
        `;
      }
    } else {
      tooltip.style.display = 'none';
    }
  }
}

async function loadData() {
  try {
    const data = await d3.csv('data/Loan_approval_data_2025.csv', d => ({
      customer_id: d.customer_id,
      annual_income: +d.annual_income,
      credit_score: +d.credit_score,
      debt_to_income_ratio: +d.debt_to_income_ratio,
      loan_status: +d.loan_status
    }));

    createScatterPlot(data);
    createAxes(data);
  } catch (error) {
    console.error('Error loading data:', error);
    alert('Error loading CSV file. Make sure the file exists at data/Loan_approval_data_2025.csv');
  }
}

function createScatterPlot(data) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const userData = [];

  // Calculate scales
  const xExtent = d3.extent(data, d => d.annual_income);
  const yExtent = d3.extent(data, d => d.credit_score);
  const zExtent = d3.extent(data, d => d.debt_to_income_ratio);

  const xScale = d3.scaleLinear().domain(xExtent).range([-150, 150]);
  const yScale = d3.scaleLinear().domain(yExtent).range([-100, 100]);
  const zScale = d3.scaleLinear().domain(zExtent).range([-100, 100]);

  const approvedColor = new THREE.Color(0x1a9850);
  const rejectedColor = new THREE.Color(0xd73027);

  data.forEach(d => {
    positions.push(
      xScale(d.annual_income),
      yScale(d.credit_score),
      zScale(d.debt_to_income_ratio)
    );

    const color = d.loan_status === 1 ? approvedColor : rejectedColor;
    colors.push(color.r, color.g, color.b);
    userData.push(d);
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });

  points = new THREE.Points(geometry, material);
  points.userData = userData;
  scene.add(points);
}

function createAxes(data) {
  const xExtent = d3.extent(data, d => d.annual_income);
  const yExtent = d3.extent(data, d => d.credit_score);
  const zExtent = d3.extent(data, d => d.debt_to_income_ratio);

  // X axis (red)
  createAxis([-150, 0, 0], [150, 0, 0], 0xff0000);
  // Y axis (green)
  createAxis([0, -100, 0], [0, 100, 0], 0x00ff00);
  // Z axis (blue)
  createAxis([0, 0, -100], [0, 0, 100], 0x0000ff);

  // Create grid
  const gridHelper = new THREE.GridHelper(300, 20, 0x444444, 0x222222);
  scene.add(gridHelper);
}

function createAxis(start, end, color) {
  const material = new THREE.LineBasicMaterial({ color: color });
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...start),
    new THREE.Vector3(...end)
  ]);
  const line = new THREE.Line(geometry, material);
  scene.add(line);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// Start the application
init();