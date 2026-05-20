const fs = require('fs');
const file = 'frontend/src/pages/Dashboard.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
// We need to find the start and end of both sections to be safe.
const startGrid = lines.findIndex(l => l.includes('{/* Two-column: Workout + Meals */}'));
const endGrid = lines.findIndex(l => l.includes('{/* Food Log — Full Width Below */}')) - 1;
const startFood = endGrid + 1;
const endFood = lines.findIndex(l => l.includes('{/* Video Modal */}')) - 1;

const gridBlock = lines.slice(startGrid, endGrid);
const foodBlock = lines.slice(startFood, endFood);

const newLines = [
  ...lines.slice(0, startGrid),
  ...foodBlock,
  '',
  ...gridBlock,
  ...lines.slice(endFood)
];
fs.writeFileSync(file, newLines.join('\n'));
console.log('Swapped sections successfully');
