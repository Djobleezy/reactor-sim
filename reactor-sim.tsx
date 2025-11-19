import React, { useEffect, useRef, useState } from "react";

/**
 * Nuclear Reactor Physics & Operations Simulator
 * Educational tool demonstrating reactor neutronics, thermal-hydraulics, and control systems
 * 
 * Challenge Mode: 100-minute simulation - approximately 10 minutes at 10x speed
 * 
 * IMPORTANT DISCLAIMER:
 * This is an educational simulator that demonstrates qualitative aspects of reactor behavior.
 * It is NOT plant-specific, NOT safety-qualified, and must NOT be used for real-world 
 * operational decisions or certified training.
 */

// =============== CONSTANTS & UTILITIES ===============
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Reactor constants
const REACTOR_CONSTANTS = {
  BETA_TOTAL: 0.0065,        // Total delayed neutron fraction
  GENERATION_TIME: 2.4e-5,   // Prompt generation time (seconds)
  SOURCE_STRENGTH: 1e-7,     // Neutron source (normalized)
  ROD_WORTH_TOTAL: 0.08,     // Total rod worth (8000 pcm)
  ROD_SPEED: 0.5,            // Rod movement speed (%/s)
  DOPPLER_COEFF: -2.5,       // Fuel temperature coefficient (pcm/°C)
  MODERATOR_COEFF: -0.8,     // Moderator temperature coefficient (pcm/°C)
  FUEL_HEAT_CAPACITY: 250,   // MW·s/°C
  COOLANT_HEAT_CAPACITY: 300, // MW·s/°C
  HEAT_TRANSFER_COEFF: 1.5,  // MW/°C
  AMBIENT_LOSS_COEFF: 0.001, // MW/°C
  MIN_TEMP: 550,             // Minimum operating temp (°C)
  NORMAL_TEMP: 650,          // Normal operating temp (°C)
  MAX_TEMP: 750,             // Maximum safe temp (°C)
  MAX_POWER: 250,            // Maximum thermal power (MW)
  SCRAM_POWER: 300,          // SCRAM setpoint (MW)
  SCRAM_TEMP: 750,           // SCRAM setpoint (°C)
  SCRAM_PERIOD: 10,          // Minimum period (seconds)
  XENON_YIELD: 0.061,        // Xe-135 cumulative yield
  XENON_DECAY: 2.1e-5,       // Xe-135 decay constant (1/s)
  IODINE_DECAY: 2.9e-5,      // I-135 decay constant (1/s)
  XENON_ABSORPTION: 2.6e6,   // Microscopic absorption cross section (barns)
  XENON_MAX_WORTH: -3000,    // Maximum xenon worth (pcm)
};

const REACTOR_PHASE = {
  SHUTDOWN: 'shutdown',
  SUBCRITICAL: 'subcritical',
  CRITICAL: 'critical',
  POWER_ASCENSION: 'power_ascension',
  AT_POWER: 'at_power',
  SCRAMMED: 'scrammed'
};

const ALARM_LEVEL = {
  ADVISORY: 'advisory',
  WARNING: 'warning',
  TRIP: 'trip'
};

// =============== REACTOR PHYSICS SIMULATOR ===============
class AdvancedReactorSimulator {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.neutronDensity = REACTOR_CONSTANTS.SOURCE_STRENGTH;
    this.thermalPower = 0.0001;
    
    const sourceEquilibrium = REACTOR_CONSTANTS.SOURCE_STRENGTH;
    this.precursors = [
      sourceEquilibrium * 0.00025 / 0.0124,
      sourceEquilibrium * 0.00136 / 0.0305,
      sourceEquilibrium * 0.00120 / 0.111,
      sourceEquilibrium * 0.00257 / 0.301,
      sourceEquilibrium * 0.00075 / 1.14,
      sourceEquilibrium * 0.00027 / 3.01
    ];
    
    this.fuelTemp = REACTOR_CONSTANTS.MIN_TEMP;
    this.coolantTemp = REACTOR_CONSTANTS.MIN_TEMP;
    this.xenonConc = 0;
    this.iodineConc = 0;
    this.rodPosition = 95;
    this.targetRodPosition = 95;
    this.rodReactivity = this.calculateRodWorth(95);
    this.tempReactivity = 0;
    this.xenonReactivity = 0;
    this.totalReactivity = this.rodReactivity;
    this.phase = REACTOR_PHASE.SHUTDOWN;
    this.keff = 0.95;
    this.period = Infinity;
    this.doublingTime = Infinity;
    this.startupRate = 0;
    this.time = 0;
    this.totalEnergyMWh = 0;  // Total energy generated in MWh
    this.sessionStartTime = 0;
    this.history = [];
    this.alarms = [];
    
    this.delayedGroups = [
      { beta: 0.00025, lambda: 0.0124 },
      { beta: 0.00136, lambda: 0.0305 },
      { beta: 0.00120, lambda: 0.111 },
      { beta: 0.00257, lambda: 0.301 },
      { beta: 0.00075, lambda: 1.14 },
      { beta: 0.00027, lambda: 3.01 }
    ];
    
    this.pushHistory();
  }
  
  calculateRodWorth(position) {
    const x = position / 100;
    const criticalPoint = 0.35;
    const maxPositiveWorth = 3000;
    const maxNegativeWorth = -5000;
    
    if (x <= criticalPoint) {
      const fraction = x / criticalPoint;
      return maxPositiveWorth * (1 - fraction);
    } else {
      const fraction = (x - criticalPoint) / (1 - criticalPoint);
      return maxNegativeWorth * Math.tanh(fraction * 2);
    }
  }
  
  calculateTempFeedback() {
    const fuelFeedback = REACTOR_CONSTANTS.DOPPLER_COEFF * 
      (this.fuelTemp - REACTOR_CONSTANTS.NORMAL_TEMP);
    const coolantFeedback = REACTOR_CONSTANTS.MODERATOR_COEFF * 
      (this.coolantTemp - REACTOR_CONSTANTS.NORMAL_TEMP);
    return fuelFeedback + coolantFeedback;
  }
  
  calculateXenonWorth() {
    return REACTOR_CONSTANTS.XENON_MAX_WORTH * this.xenonConc;
  }
  
  updateNeutronics(dt) {
    this.rodReactivity = this.calculateRodWorth(this.rodPosition);
    this.tempReactivity = this.calculateTempFeedback();
    this.xenonReactivity = this.calculateXenonWorth();
    this.totalReactivity = this.rodReactivity + this.tempReactivity + this.xenonReactivity;
    
    const rho = this.totalReactivity / 100000;
    
    this.keff = 1 / (1 - rho);
    this.keff = clamp(this.keff, 0.85, 1.15);
    
    const beta = REACTOR_CONSTANTS.BETA_TOTAL;
    const Lambda = REACTOR_CONSTANTS.GENERATION_TIME;
    
    if (Math.abs(rho) > 1e-6) {
      if (rho > beta) {
        this.period = Lambda / (rho - beta);
      } else if (rho > 0) {
        this.period = beta / (rho * Lambda);
      } else {
        this.period = -Lambda / Math.abs(rho);
      }
      this.doublingTime = this.period * Math.log(2);
    } else {
      this.period = Infinity;
      this.doublingTime = Infinity;
    }
    
    if (this.period !== Infinity && Math.abs(this.period) > 0.1) {
      this.startupRate = 26.06 / this.period;
    } else {
      this.startupRate = 0;
    }
    
    const S = REACTOR_CONSTANTS.SOURCE_STRENGTH;
    
    if (rho < -0.01) {
      const subcriticalLevel = S / (1 - this.keff);
      const approach = Math.min(1, dt * 0.5);
      this.neutronDensity = this.neutronDensity + (subcriticalLevel - this.neutronDensity) * approach;
    } else {
      let dndt = ((rho - beta) / Lambda) * this.neutronDensity;
      
      for (let i = 0; i < 6; i++) {
        dndt = dndt + this.delayedGroups[i].lambda * this.precursors[i];
      }
      
      dndt = dndt + S / Lambda;
      
      const maxRate = 0.2 / dt;
      if (this.neutronDensity > 1e-6 && Math.abs(dndt) > maxRate * this.neutronDensity) {
        dndt = Math.sign(dndt) * maxRate * this.neutronDensity;
      }
      
      this.neutronDensity = this.neutronDensity + dndt * dt;
    }
    
    for (let i = 0; i < 6; i++) {
      const group = this.delayedGroups[i];
      const production = (group.beta / Lambda) * this.neutronDensity;
      const decay = group.lambda * this.precursors[i];
      this.precursors[i] = this.precursors[i] + (production - decay) * dt;
      this.precursors[i] = Math.max(0, this.precursors[i]);
    }
    
    this.neutronDensity = clamp(this.neutronDensity, S, 1.0);
    
    const targetPower = this.neutronDensity * REACTOR_CONSTANTS.MAX_POWER / 1e-3;
    const powerAlpha = 1 - Math.exp(-dt / 3.0);
    this.thermalPower = this.thermalPower * (1 - powerAlpha) + targetPower * powerAlpha;
    this.thermalPower = clamp(this.thermalPower, 0, REACTOR_CONSTANTS.MAX_POWER * 1.2);
  }
  
  updateThermalHydraulics(dt) {
    const heatGenerated = this.thermalPower;
    const heatTransferCoeff = 2.0;
    const heatTransfer = heatTransferCoeff * (this.fuelTemp - this.coolantTemp);
    
    const coolingEfficiency = 0.95;
    const baseHeatRemoval = this.thermalPower * coolingEfficiency;
    const tempDrivenCooling = 0.5 * (this.coolantTemp - REACTOR_CONSTANTS.MIN_TEMP);
    const heatRemoved = Math.min(baseHeatRemoval + tempDrivenCooling, heatTransfer);
    
    const ambientLoss = 0.01 * (this.coolantTemp - REACTOR_CONSTANTS.MIN_TEMP);
    
    const fuelHeatCapacity = 100;
    const fuelEnergyBalance = heatGenerated - heatTransfer;
    const dTfuel = fuelEnergyBalance / fuelHeatCapacity;
    this.fuelTemp = this.fuelTemp + dTfuel * dt;
    
    const coolantHeatCapacity = 150;
    const coolantEnergyBalance = heatTransfer - heatRemoved - ambientLoss;
    const dTcoolant = coolantEnergyBalance / coolantHeatCapacity;
    this.coolantTemp = this.coolantTemp + dTcoolant * dt;
    
    this.fuelTemp = clamp(this.fuelTemp, REACTOR_CONSTANTS.MIN_TEMP, REACTOR_CONSTANTS.MAX_TEMP + 50);
    this.coolantTemp = clamp(this.coolantTemp, REACTOR_CONSTANTS.MIN_TEMP, REACTOR_CONSTANTS.MAX_TEMP);
  }
  
  updateXenonDynamics(dt) {
    const normalizedFlux = this.thermalPower / REACTOR_CONSTANTS.MAX_POWER;
    
    const iodineYield = 0.061;
    const iodineProduction = iodineYield * normalizedFlux * 0.002;
    
    const iodineDecayConstant = 2.9e-5;
    const iodineDecay = iodineDecayConstant * this.iodineConc * 10;
    
    const dIdt = iodineProduction - iodineDecay;
    this.iodineConc = Math.max(0, Math.min(1, this.iodineConc + dIdt * dt));
    
    const xenonFromIodine = iodineDecay;
    
    const xenonDirectYield = 0.003;
    const directXenon = xenonDirectYield * normalizedFlux * 0.002;
    
    const xenonDecayConstant = 2.1e-5;
    const xenonDecay = xenonDecayConstant * this.xenonConc * 10;
    
    const xenonBurnupRate = 0.2;
    const xenonBurnup = xenonBurnupRate * normalizedFlux * this.xenonConc;
    
    const dXdt = xenonFromIodine + directXenon - xenonDecay - xenonBurnup;
    this.xenonConc = Math.max(0, Math.min(1, this.xenonConc + dXdt * dt));
  }
  
  updateControlRods(dt) {
    const rodDiff = this.targetRodPosition - this.rodPosition;
    const maxMove = REACTOR_CONSTANTS.ROD_SPEED * dt;
    
    if (Math.abs(rodDiff) > maxMove) {
      this.rodPosition = this.rodPosition + Math.sign(rodDiff) * maxMove;
    } else {
      this.rodPosition = this.targetRodPosition;
    }
    
    this.rodPosition = clamp(this.rodPosition, 0, 100);
  }
  
  updatePhase() {
    if (this.phase === REACTOR_PHASE.SCRAMMED) {
      return;
    }
    
    if (this.keff < 0.95) {
      this.phase = REACTOR_PHASE.SHUTDOWN;
    } else if (this.keff < 0.999) {
      this.phase = REACTOR_PHASE.SUBCRITICAL;
    } else if (this.thermalPower < 1) {
      this.phase = REACTOR_PHASE.CRITICAL;
    } else if (this.thermalPower < REACTOR_CONSTANTS.MAX_POWER * 0.9) {
      this.phase = REACTOR_PHASE.POWER_ASCENSION;
    } else {
      this.phase = REACTOR_PHASE.AT_POWER;
    }
  }
  
  checkAlarms() {
    const alarms = [];
    
    if (this.period > 0 && this.period < REACTOR_CONSTANTS.SCRAM_PERIOD) {
      this.scram();
      alarms.push({
        level: ALARM_LEVEL.TRIP,
        message: `REACTOR TRIP: Short period (${this.period.toFixed(1)}s)`,
        time: this.time
      });
    }
    
    if (this.thermalPower > REACTOR_CONSTANTS.SCRAM_POWER) {
      this.scram();
      alarms.push({
        level: ALARM_LEVEL.TRIP,
        message: `REACTOR TRIP: High power (${this.thermalPower.toFixed(0)} MW)`,
        time: this.time
      });
    }
    
    if (this.fuelTemp > REACTOR_CONSTANTS.SCRAM_TEMP || 
        this.coolantTemp > REACTOR_CONSTANTS.SCRAM_TEMP) {
      this.scram();
      alarms.push({
        level: ALARM_LEVEL.TRIP,
        message: `REACTOR TRIP: High temperature`,
        time: this.time
      });
    }
    
    // Warning for approaching power limit
    if (this.thermalPower > 255 && this.thermalPower <= REACTOR_CONSTANTS.SCRAM_POWER && 
        this.phase !== REACTOR_PHASE.SCRAMMED) {
      alarms.push({
        level: ALARM_LEVEL.WARNING,
        message: `Power approaching limit: ${this.thermalPower.toFixed(0)} MW`,
        time: this.time
      });
    }
    
    if (this.startupRate > 1.0 && this.phase === REACTOR_PHASE.SUBCRITICAL) {
      alarms.push({
        level: ALARM_LEVEL.WARNING,
        message: `High startup rate: ${this.startupRate.toFixed(1)} DPM`,
        time: this.time
      });
    }
    
    return alarms;
  }
  
  scram() {
    if (this.phase !== REACTOR_PHASE.SCRAMMED) {
      this.phase = REACTOR_PHASE.SCRAMMED;
      this.targetRodPosition = 100;
      // Immediately start moving rods in
      this.rodPosition = Math.min(100, this.rodPosition + 5);
    }
  }
  
  step(dt) {
    dt = Math.min(dt, 0.05);
    
    this.updateControlRods(dt);
    this.updateNeutronics(dt);
    this.updateThermalHydraulics(dt);
    this.updateXenonDynamics(dt);
    this.updatePhase();
    
    // Calculate energy generated (MW * hours = MWh)
    const energyGenerated = this.thermalPower * (dt / 3600); // Convert seconds to hours
    this.totalEnergyMWh += energyGenerated;
    
    const alarms = this.checkAlarms();
    this.alarms = [...this.alarms, ...alarms].slice(-10);
    
    this.time = this.time + dt;
    this.pushHistory();
    
    return alarms;
  }
  
  pushHistory() {
    const entry = {
      t: this.time,
      power: this.thermalPower,
      neutrons: this.neutronDensity,
      keff: this.keff,
      period: this.period,
      fuelTemp: this.fuelTemp,
      coolantTemp: this.coolantTemp,
      rodPosition: this.rodPosition,
      totalReactivity: this.totalReactivity,
      xenon: this.xenonConc,
      phase: this.phase,
      startupRate: this.startupRate
    };
    
    this.history.push(entry);
    
    const historyLimit = 600;
    while (this.history.length > 0 && this.history[0].t < this.time - historyLimit) {
      this.history.shift();
    }
  }
  
  moveRods(targetPosition) {
    this.targetRodPosition = clamp(targetPosition, 0, 100);
  }
  
  insertRods(percent) {
    this.moveRods(this.targetRodPosition + percent);
  }
  
  withdrawRods(percent) {
    this.moveRods(this.targetRodPosition - percent);
  }
}

// =============== VISUAL COMPONENTS ===============

// Animated Analog Gauge Component
function AnalogGauge({ value, min, max, label, unit, redZone = null, yellowZone = null, size = 150 }) {
  // Clamp value to range
  const clampedValue = Math.max(min, Math.min(max, value));
  
  // Calculate angle: -135 deg at min, +135 deg at max (270 degree sweep)
  const normalizedValue = (clampedValue - min) / (max - min);
  const needleAngle = (normalizedValue * 270) - 135;
  
  const majorTicks = [];
  const numTicks = 5;
  for (let i = 0; i <= numTicks; i++) {
    const tickAngle = -135 + (270 * i / numTicks);
    const tickValue = min + (max - min) * i / numTicks;
    majorTicks.push({ angle: tickAngle, value: tickValue });
  }
  
  const centerX = size / 2;
  const centerY = size / 2;
  const needleLength = size / 2 - 25;
  
  // Calculate needle endpoint
  const needleAngleRad = (needleAngle * Math.PI) / 180;
  const needleEndX = centerX + needleLength * Math.cos(needleAngleRad);
  const needleEndY = centerY + needleLength * Math.sin(needleAngleRad);
  
  return (
    <div className="relative inline-block">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background Circle */}
        <circle 
          cx={centerX} 
          cy={centerY} 
          r={size/2 - 10}
          fill="#1a1a2e"
          stroke="#333"
          strokeWidth="2"
        />
        
        {/* Major Ticks */}
        {majorTicks.map((tick, i) => {
          const angleRad = (tick.angle * Math.PI) / 180;
          const innerRadius = size/2 - 30;
          const outerRadius = size/2 - 20;
          const labelRadius = size/2 - 40;
          
          const x1 = centerX + outerRadius * Math.cos(angleRad);
          const y1 = centerY + outerRadius * Math.sin(angleRad);
          const x2 = centerX + innerRadius * Math.cos(angleRad);
          const y2 = centerY + innerRadius * Math.sin(angleRad);
          const labelX = centerX + labelRadius * Math.cos(angleRad);
          const labelY = centerY + labelRadius * Math.sin(angleRad);
          
          return (
            <g key={i}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#666"
                strokeWidth="2"
              />
              <text
                x={labelX} y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#999"
                fontSize="10"
              >
                {tick.value >= 1000 ? `${(tick.value/1000).toFixed(0)}k` : tick.value.toFixed(0)}
              </text>
            </g>
          );
        })}
        
        {/* Needle - simple line from center to calculated endpoint */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleEndX}
          y2={needleEndY}
          stroke="#00ff00"
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Needle glow shadow */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleEndX}
          y2={needleEndY}
          stroke="#00ff00"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.3"
        />
        
        {/* Center Cap */}
        <circle cx={centerX} cy={centerY} r="8" fill="#333" stroke="#00ff00" strokeWidth="2" />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-8">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="font-mono font-bold text-lg text-cyan-400">
          {clampedValue.toFixed(1)} {unit}
        </div>
      </div>
    </div>
  );
}

// LED Indicator Component
function LEDIndicator({ on, color = 'green', label, blink = false }) {
  const colors = {
    green: on ? '#10b981' : '#064e3b',
    red: on ? '#ef4444' : '#7f1d1d',
    yellow: on ? '#fbbf24' : '#78350f',
    blue: on ? '#3b82f6' : '#1e3a8a'
  };
  
  return (
    <div className="flex items-center gap-2">
      <div 
        className={`w-4 h-4 rounded-full border border-gray-600 ${blink && on ? 'animate-pulse' : ''}`}
        style={{
          backgroundColor: colors[color],
          boxShadow: on ? `0 0 10px ${colors[color]}` : 'none'
        }}
      />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

// Control Rod Position Display
function RodPositionDisplay({ position, targetPosition }) {
  const rods = [];
  for (let i = 0; i < 5; i++) {
    rods.push(
      <div key={i} className="relative w-8 h-48 bg-gray-800 border border-gray-600 rounded">
        <div 
          className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded transition-all duration-500"
          style={{ height: `${100 - position}%` }}
        />
        <div 
          className="absolute bottom-0 w-full border-2 border-yellow-400 opacity-50"
          style={{ height: `${100 - targetPosition}%` }}
        />
      </div>
    );
  }
  
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <h4 className="text-sm font-bold text-yellow-400 mb-3 text-center">CONTROL ROD POSITION</h4>
      <div className="flex gap-2 justify-center mb-3">
        {rods}
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-400">Current / Target</div>
        <div className="font-mono text-lg font-bold">
          <span className="text-cyan-400">{position.toFixed(2)}%</span>
          <span className="text-gray-600"> / </span>
          <span className="text-yellow-400">{targetPosition.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

// Alarm Panel
function AlarmPanel({ alarms }) {
  const [acknowledged, setAcknowledged] = useState(new Set());
  
  const activeAlarms = alarms.filter(a => !acknowledged.has(a.time));
  
  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-red-600">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-bold text-red-400">ALARM PANEL</h4>
        {activeAlarms.length > 0 && (
          <button
            onClick={() => setAcknowledged(new Set(alarms.map(a => a.time)))}
            className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs animate-pulse"
          >
            ACK ALL
          </button>
        )}
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {activeAlarms.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-2">No Active Alarms</div>
        ) : (
          activeAlarms.map((alarm, i) => (
            <div 
              key={i}
              className={`p-1 rounded text-xs flex items-center gap-2 ${
                alarm.level === ALARM_LEVEL.TRIP ? 'bg-red-900/50 text-red-300 animate-pulse' :
                alarm.level === ALARM_LEVEL.WARNING ? 'bg-yellow-900/50 text-yellow-300' :
                'bg-blue-900/50 text-blue-300'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                alarm.level === ALARM_LEVEL.TRIP ? 'bg-red-500' :
                alarm.level === ALARM_LEVEL.WARNING ? 'bg-yellow-500' :
                'bg-blue-500'
              }`} />
              <span className="flex-1">{alarm.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Strip Chart Recorder
function StripChart({ data, dataKey, label, color = '#10b981', height = 100 }) {
  const svgRef = useRef(null);
  
  if (data.length === 0) return null;
  
  const values = data.map(d => d[dataKey] || 0);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  
  // Add 10% padding to top and bottom for better visibility
  const range = maxValue - minValue;
  const paddedMax = maxValue + (range * 0.1);
  const paddedMin = minValue - (range * 0.1);
  
  // If all values are very close, add fixed padding
  const displayMax = range < 1 ? maxValue + 0.5 : paddedMax;
  const displayMin = range < 1 ? minValue - 0.5 : paddedMin;
  
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 400;
    const normalizedY = (d[dataKey] - displayMin) / (displayMax - displayMin);
    const y = height - (normalizedY * height);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div className="bg-gray-900 rounded p-2 border border-gray-700">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 400 ${height}`}>
        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(y => (
          <line
            key={y}
            x1="0"
            y1={y * height}
            x2="400"
            y2={y * height}
            stroke="#333"
            strokeDasharray="2,2"
          />
        ))}
        
        {/* Data Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          filter="url(#chartGlow)"
        />
        
        {/* Glow Effect */}
        <defs>
          <filter id="chartGlow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{displayMin.toFixed(1)}</span>
        <span>{displayMax.toFixed(1)}</span>
      </div>
    </div>
  );
}

// Digital Display Component
function DigitalDisplay({ value, label, unit, decimals = 1, warning = false, critical = false }) {
  const displayColor = critical ? 'text-red-400' : warning ? 'text-yellow-400' : 'text-green-400';
  const bgColor = critical ? 'bg-red-900/20' : warning ? 'bg-yellow-900/20' : 'bg-gray-900';
  
  return (
    <div className={`${bgColor} rounded p-2 border ${critical ? 'border-red-600 animate-pulse' : warning ? 'border-yellow-600' : 'border-gray-700'}`}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`font-mono text-2xl font-bold ${displayColor}`}>
        {typeof value === 'number' && !isFinite(value) ? '---' : value.toFixed(decimals)}
      </div>
      <div className="text-xs text-gray-500">{unit}</div>
    </div>
  );
}

// Main Control Panel Component
function ControlPanel({ reactor, onRodMove, onScram }) {
  return (
    <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-4 border-2 border-gray-600">
      <h3 className="text-center font-bold text-yellow-400 mb-4 text-lg">CONTROL ROD SYSTEM</h3>
      
      <RodPositionDisplay position={reactor.rodPosition} targetPosition={reactor.targetRodPosition} />
      
      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => onRodMove('out-fast')} 
            className="py-2 bg-gradient-to-b from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded font-bold text-sm shadow-lg"
          >
            ↑↑↑ FAST 10%
          </button>
          <button 
            onClick={() => onRodMove('in-fast')}
            className="py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded font-bold text-sm shadow-lg"
          >
            ↓↓↓ FAST 10%
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => onRodMove('out-slow')}
            className="py-2 bg-gradient-to-b from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 rounded font-bold text-sm shadow-lg"
          >
            ↑↑ WITHDRAW 1%
          </button>
          <button 
            onClick={() => onRodMove('in-slow')}
            className="py-2 bg-gradient-to-b from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 rounded font-bold text-sm shadow-lg"
          >
            ↓↓ INSERT 1%
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => onRodMove('out-fine')}
            className="py-2 bg-gradient-to-b from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 rounded text-sm shadow-lg"
          >
            ↑ FINE 0.5%
          </button>
          <button 
            onClick={() => onRodMove('in-fine')}
            className="py-2 bg-gradient-to-b from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded text-sm shadow-lg"
          >
            ↓ FINE 0.5%
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => onRodMove('out-ultrafine')}
            className="py-2 bg-gradient-to-b from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded text-xs shadow-lg"
          >
            ↑ ULTRA 0.1%
          </button>
          <button 
            onClick={() => onRodMove('in-ultrafine')}
            className="py-2 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded text-xs shadow-lg"
          >
            ↓ ULTRA 0.1%
          </button>
        </div>
        <div className="text-xs text-center text-gray-400 mt-2">
          STEP SIZE: 10% | 1% | 0.5% | 0.1%
        </div>
      </div>
      
      <button 
        onClick={onScram}
        className="w-full mt-4 py-3 bg-gradient-to-b from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 rounded-lg font-bold text-lg shadow-xl border-2 border-red-400 animate-pulse"
      >
        ⚠ EMERGENCY SCRAM
      </button>
    </div>
  );
}

// Status Indicator Panel
function StatusPanel({ reactor }) {
  const getPhaseColor = () => {
    switch (reactor.phase) {
      case REACTOR_PHASE.SCRAMMED: return 'text-red-500';
      case REACTOR_PHASE.SHUTDOWN: return 'text-gray-500';
      case REACTOR_PHASE.SUBCRITICAL: return 'text-amber-500';
      case REACTOR_PHASE.CRITICAL: return 'text-blue-500';
      case REACTOR_PHASE.POWER_ASCENSION: return 'text-yellow-500';
      case REACTOR_PHASE.AT_POWER: return 'text-green-500';
      default: return 'text-gray-500';
    }
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
      <h3 className="text-center font-bold text-cyan-400 mb-3">REACTOR STATUS</h3>
      
      <div className={`text-center text-2xl font-bold mb-4 ${getPhaseColor()}`}>
        {reactor.phase.toUpperCase().replace('_', ' ')}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <LEDIndicator on={reactor.keff >= 0.999} color="green" label="CRITICAL" />
        <LEDIndicator on={reactor.thermalPower > 1} color="blue" label="POWER RANGE" />
        <LEDIndicator on={reactor.period > 0 && reactor.period < 30} color="yellow" label="SHORT PERIOD" blink />
        <LEDIndicator on={reactor.phase === REACTOR_PHASE.SCRAMMED} color="red" label="SCRAMMED" blink />
        <LEDIndicator on={reactor.rodPosition < 10} color="yellow" label="RODS OUT LIMIT" />
        <LEDIndicator on={reactor.rodPosition > 90} color="yellow" label="RODS IN LIMIT" />
        <LEDIndicator on={Math.abs(reactor.totalReactivity) > 200} color="yellow" label="HIGH REACTIVITY" />
        <LEDIndicator on={reactor.fuelTemp > 700} color="red" label="HIGH TEMP" blink />
      </div>
    </div>
  );
}

// Strategy Tips Component
function StrategyTips({ show, onToggle }) {
  if (!show) {
    return (
      <button 
        onClick={onToggle}
        className="w-full bg-blue-900/30 hover:bg-blue-900/50 rounded-lg p-2 border border-blue-700 text-sm text-blue-400 transition-all">
        💡 Show Strategy Tips
      </button>
    );
  }
  
  return (
    <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-bold text-blue-400">💡 OPERATOR STRATEGY GUIDE</h4>
        <button onClick={onToggle} className="text-blue-400 hover:text-blue-300 text-sm">Hide</button>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-black/40 rounded p-3">
          <div className="text-green-400 font-bold mb-1">🚀 Power Ascension</div>
          <ul className="text-gray-300 space-y-1 text-xs">
            <li>• Withdraw rods steadily (0.5-1% steps)</li>
            <li>• Target 15-20 min to full power</li>
            <li>• Monitor startup rate &lt; 1 DPM</li>
            <li>• Keep period &gt; 30 seconds</li>
          </ul>
        </div>
        <div className="bg-black/40 rounded p-3">
          <div className="text-purple-400 font-bold mb-1">⚖️ Steady State Operation</div>
          <ul className="text-gray-300 space-y-1 text-xs">
            <li>• Hold near 250 MW for 80 minutes</li>
            <li>• Use fine rod movements to balance</li>
            <li>• Let temperature stabilize naturally</li>
            <li>• Monitor xenon buildup over time</li>
          </ul>
        </div>
        <div className="bg-black/40 rounded p-3">
          <div className="text-yellow-400 font-bold mb-1">⚠️ Safety Limits</div>
          <ul className="text-gray-300 space-y-1 text-xs">
            <li>• Power SCRAM at 300 MW (-10 pts!)</li>
            <li>• Temperature SCRAM at 750°C</li>
            <li>• Period SCRAM at 10 seconds</li>
            <li>• Stay below 255 MW for safe operation</li>
            <li>• Warnings are OK - SCRAMS are costly!</li>
          </ul>
        </div>
        <div className="bg-black/40 rounded p-3">
          <div className="text-blue-400 font-bold mb-1">🎯 Scoring Tips</div>
          <ul className="text-gray-300 space-y-1 text-xs">
            <li>• Reach full power in ~20 min safely</li>
            <li>• Maintain 90%+ capacity factor</li>
            <li>• 375+ MWh target (100-min operation)</li>
            <li>• Avoid ALL trips for +10 bonus</li>
            <li>• Play at 10x speed: ~10 min real time</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Game Mode Component
function GameModeSelector({ mode, onModeChange }) {
  return (
    <div className="flex gap-2 bg-black/70 rounded-lg p-2 border border-purple-900">
      <button
        onClick={() => onModeChange('sandbox')}
        className={`px-4 py-2 rounded font-bold text-sm transition-all ${
          mode === 'sandbox' 
            ? 'bg-purple-600 text-white shadow-lg' 
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}>
        🎮 SANDBOX
      </button>
      <button
        onClick={() => onModeChange('challenge')}
        className={`px-4 py-2 rounded font-bold text-sm transition-all ${
          mode === 'challenge' 
            ? 'bg-purple-600 text-white shadow-lg' 
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}>
        🏆 CHALLENGE
      </button>
    </div>
  );
}

// Game Over Modal
function GameOverModal({ score, onRestart, onClose }) {
  const getRating = (score) => {
    if (score >= 90) return { grade: 'S', color: 'text-yellow-400', comment: 'LEGENDARY OPERATOR!' };
    if (score >= 80) return { grade: 'A', color: 'text-green-400', comment: 'EXCELLENT PERFORMANCE' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-400', comment: 'GOOD JOB' };
    if (score >= 60) return { grade: 'C', color: 'text-orange-400', comment: 'ACCEPTABLE' };
    return { grade: 'D', color: 'text-red-400', comment: 'NEEDS IMPROVEMENT' };
  };
  
  const rating = getRating(score.totalScore);
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur">
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-8 border-4 border-purple-500 max-w-2xl w-full mx-4 shadow-2xl">
        <h2 className="text-4xl font-bold text-center mb-6 text-purple-400">CHALLENGE COMPLETE!</h2>
        
        <div className="text-center mb-8">
          <div className={`text-8xl font-bold ${rating.color} mb-2`}>{rating.grade}</div>
          <div className="text-xl text-gray-300">{rating.comment}</div>
        </div>
        
        <div className="bg-black/50 rounded-lg p-4 mb-6 border border-cyan-900">
          <div className="text-center text-sm text-gray-400 mb-2">SCORE BREAKDOWN</div>
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className="text-center">
              <div className="text-green-400 font-bold">{score.energyScore.toFixed(1)}</div>
              <div className="text-gray-500">Energy</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 font-bold">{score.capacityScore.toFixed(1)}</div>
              <div className="text-gray-500">Capacity</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-bold">{score.peakScore.toFixed(1)}</div>
              <div className="text-gray-500">Peak</div>
            </div>
            <div className="text-center">
              <div className="text-yellow-400 font-bold">+{score.stabilityBonus}</div>
              <div className="text-gray-500">Bonus</div>
            </div>
            <div className="text-center">
              <div className="text-red-400 font-bold">-{score.penalties}</div>
              <div className="text-gray-500">Penalty</div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-black/50 rounded-lg p-4 border border-green-900">
            <div className="text-sm text-gray-400 mb-1">Energy Generated</div>
            <div className="text-3xl font-mono font-bold text-green-400">{score.energy.toFixed(2)} MWh</div>
            <div className="text-sm text-purple-400 mt-1">Target: 375+ MWh</div>
          </div>
          
          <div className="bg-black/50 rounded-lg p-4 border border-purple-900">
            <div className="text-sm text-gray-400 mb-1">Capacity Factor</div>
            <div className="text-3xl font-mono font-bold text-purple-400">{score.capacityFactor.toFixed(1)}%</div>
            <div className="text-sm text-purple-400 mt-1">Target: 90%+</div>
          </div>
          
          <div className="bg-black/50 rounded-lg p-4 border border-blue-900">
            <div className="text-sm text-gray-400 mb-1">Peak Power</div>
            <div className="text-3xl font-mono font-bold text-blue-400">{score.peakPower.toFixed(1)} MW</div>
            <div className="text-sm text-purple-400 mt-1">Target: 250 MW</div>
          </div>
          
          <div className="bg-black/50 rounded-lg p-4 border border-yellow-900">
            <div className="text-sm text-gray-400 mb-1">Safety Performance</div>
            <div className={`text-3xl font-mono font-bold ${score.tripCount === 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {score.tripCount === 0 ? '+10' : '0'}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {score.tripCount === 0 ? 'Perfect! Zero trips' : `${score.tripCount} SCRAM${score.tripCount > 1 ? 's' : ''} (-${score.penalties} pts)`}
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-4 mb-6 border border-purple-500">
          <div className="text-center">
            <div className="text-sm text-gray-400">FINAL SCORE</div>
            <div className="text-5xl font-bold text-purple-400">{score.totalScore.toFixed(1)}</div>
            <div className="text-sm text-gray-500 mt-1">out of 100</div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={onRestart}
            className="flex-1 py-3 bg-gradient-to-b from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg font-bold shadow-lg">
            🔄 NEW CHALLENGE
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gradient-to-b from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg font-bold shadow-lg">
            📊 REVIEW
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Application Component
export default function App() {
  const [reactor] = useState(() => new AdvancedReactorSimulator());
  const [state, setState] = useState(reactor);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [peakPower, setPeakPower] = useState(0);
  const [gameMode, setGameMode] = useState('sandbox');
  const [challengeTimeLeft, setChallengeTimeLeft] = useState(100 * 60); // 100 minutes in seconds (~10 min at 10x)
  const [tripCount, setTripCount] = useState(0);
  const [alarmCount, setAlarmCount] = useState(0);
  const [showGameOver, setShowGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [bestScore, setBestScore] = useState(0);
  const [showTips, setShowTips] = useState(false);
  const animationRef = useRef();
  const lastTimeRef = useRef(performance.now());
  
  useEffect(() => {
    if (!running) return;
    
    const animate = (currentTime) => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      
      const dt = Math.min(0.05, deltaTime * speed);
      
      // Check for new alarms before stepping
      const beforeAlarms = reactor.alarms.length;
      reactor.step(dt);
      const afterAlarms = reactor.alarms.length;
      
      // Count only TRIP level alarms (not warnings)
      if (afterAlarms > beforeAlarms) {
        const newAlarms = reactor.alarms.slice(beforeAlarms);
        newAlarms.forEach(alarm => {
          if (alarm.level === ALARM_LEVEL.TRIP) {
            setTripCount(prev => prev + 1);
          }
          // Don't count warnings or advisory alarms as penalties
        });
      }
      
      // Track peak power
      if (reactor.thermalPower > peakPower) {
        setPeakPower(reactor.thermalPower);
      }
      
      // Update challenge timer
      if (gameMode === 'challenge') {
        setChallengeTimeLeft(prev => {
          const newTime = Math.max(0, prev - dt);
          
          // End challenge when time runs out
          if (newTime === 0 && prev > 0) {
            setRunning(false);
            endChallenge();
          }
          
          return newTime;
        });
      }
      
      setState({...reactor});
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [running, speed, reactor, peakPower, gameMode]);
  
  const calculateScore = (reactorData = null) => {
    // Use provided reactor data if available, otherwise use state
    const data = reactorData || state;
    
    const energy = data.totalEnergyMWh;
    const capacityFactor = data.time > 0 
      ? (data.totalEnergyMWh / (REACTOR_CONSTANTS.MAX_POWER * data.time / 3600)) * 100 
      : 0;
    
    // Scoring breakdown for 100-minute challenge (~10 min at 10x speed):
    // Energy: 0-40 points (max at 375+ MWh - realistic with safe ramp-up)
    const energyScore = Math.min(40, (energy / 375) * 40);
    
    // Capacity Factor: 0-35 points (max at 90%+ - accounts for ramp time)  
    const capacityScore = Math.min(35, (capacityFactor / 90) * 35);
    
    // Peak Power: 0-15 points (bonus for reaching high power safely)
    const peakScore = Math.min(15, (peakPower / 250) * 15);
    
    // Safety Penalties: -10 per trip (SCRAM events only, warnings are OK)
    const penalties = tripCount * 10;
    
    // Stability bonus: 0-10 points for maintaining zero trips
    const stabilityBonus = tripCount === 0 ? 10 : 0;
    
    const totalScore = Math.max(0, Math.min(100, energyScore + capacityScore + peakScore + stabilityBonus - penalties));
    
    return {
      energy,
      capacityFactor,
      peakPower,
      energyScore,
      capacityScore,
      peakScore,
      stabilityBonus,
      penalties,
      tripCount,
      alarmCount,
      totalScore
    };
  };
  
  const endChallenge = (reactorData = null) => {
    const score = calculateScore(reactorData);
    setFinalScore(score);
    setShowGameOver(true);
    
    if (score.totalScore > bestScore) {
      setBestScore(score.totalScore);
    }
  };
  
  const handleRodMove = (action) => {
    const amounts = {
      'out-fast': -10,
      'out-slow': -1,
      'out-fine': -0.5,
      'out-ultrafine': -0.1,
      'in-ultrafine': 0.1,
      'in-fine': 0.5,
      'in-slow': 1,
      'in-fast': 10
    };
    
    const amount = amounts[action];
    if (amount > 0) {
      reactor.insertRods(amount);
    } else {
      reactor.withdrawRods(Math.abs(amount));
    }
  };
  
  const handleScram = () => {
    reactor.scram();
    setRunning(false);
  };
  
  const handleReset = () => {
    reactor.reset();
    setRunning(false);
    setPeakPower(0);
    setTripCount(0);
    setAlarmCount(0);
    setChallengeTimeLeft(100 * 60); // 100 minutes
    setShowGameOver(false);
    setFinalScore(null);
    setState({...reactor});
  };
  
  const handleModeChange = (mode) => {
    setGameMode(mode);
    setShowTips(false);
    handleReset();
  };
  
  const handleGameOverClose = () => {
    setShowGameOver(false);
  };
  
  const handleNewChallenge = () => {
    setShowGameOver(false);
    handleReset();
  };
  
  // Calculate capacity factor
  const capacityFactor = state.time > 0 
    ? (state.totalEnergyMWh / (REACTOR_CONSTANTS.MAX_POWER * state.time / 3600)) * 100 
    : 0;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur border-b border-cyan-900/50 p-3">
        <div className="max-w-full mx-auto flex items-center justify-between px-4">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 tracking-wide">
              NUCLEAR REACTOR SIMULATOR
            </h1>
            <p className="text-xs text-gray-400">Sandbox Training • 100-Min Challenge Mode (~10 min @ 10x) • Physics & Operations</p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Game Mode Selector */}
            <GameModeSelector mode={gameMode} onModeChange={handleModeChange} />
            
            {/* Challenge Timer & Score (only in challenge mode) */}
            {gameMode === 'challenge' && (
              <div className="flex gap-4">
                <div className={`bg-black/70 rounded-lg px-4 py-2 border ${
                  challengeTimeLeft < 600 ? 'border-red-600 animate-pulse' : 
                  challengeTimeLeft < 1800 ? 'border-yellow-600' : 'border-blue-600'
                }`}>
                  <div className="text-xs text-gray-400">TIME REMAINING</div>
                  <div className={`text-3xl font-mono font-bold tabular-nums ${
                    challengeTimeLeft < 600 ? 'text-red-400' : 
                    challengeTimeLeft < 1800 ? 'text-yellow-400' : 'text-blue-400'
                  }`}>
                    {Math.floor(challengeTimeLeft / 60)}:{(Math.floor(challengeTimeLeft) % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs text-gray-500">
                    sim time ({Math.floor(challengeTimeLeft / 60 / speed).toFixed(0)} min real)
                  </div>
                </div>
                
                <div className="bg-black/70 rounded-lg px-4 py-2 border border-purple-600">
                  <div className="text-xs text-gray-400">CURRENT SCORE</div>
                  <div className="text-3xl font-mono font-bold text-purple-400 tabular-nums">
                    {calculateScore().totalScore.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">/ 100 pts</div>
                </div>
                
                {bestScore > 0 && (
                  <div className="bg-black/70 rounded-lg px-4 py-2 border border-yellow-600">
                    <div className="text-xs text-gray-400">BEST SCORE</div>
                    <div className="text-3xl font-mono font-bold text-yellow-400 tabular-nums">
                      {bestScore.toFixed(0)}
                    </div>
                    <div className="text-xs text-gray-500">🏆</div>
                  </div>
                )}
              </div>
            )}
            
            {/* Energy Statistics Panel (sandbox mode) */}
            {gameMode === 'sandbox' && (
              <div className="bg-black/70 rounded-lg px-4 py-2 border border-green-900">
                <div className="flex gap-4">
                  <div>
                    <div className="text-xs text-gray-400">TOTAL ENERGY</div>
                    <div className="text-2xl font-mono font-bold text-green-400 tabular-nums">
                      {state.totalEnergyMWh.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">MWh</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">PEAK POWER</div>
                    <div className="text-2xl font-mono font-bold text-yellow-400 tabular-nums">
                      {peakPower.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">MW</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">CAPACITY</div>
                    <div className="text-2xl font-mono font-bold text-purple-400 tabular-nums">
                      {capacityFactor.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">%</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Digital Clock Display */}
            {gameMode === 'sandbox' && (
              <div className="bg-black rounded-lg px-4 py-2 border border-cyan-900">
                <div className="text-3xl font-mono font-bold text-cyan-400 tabular-nums">
                  {Math.floor(state.time / 60).toString().padStart(2, '0')}:
                  {Math.floor(state.time % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-400 text-center">SIM TIME</div>
              </div>
            )}
            
            {/* Control Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setRunning(!running)}
                className={`px-6 py-2 rounded-lg font-bold shadow-lg transition-all ${
                  running 
                    ? 'bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
                    : 'bg-gradient-to-b from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                }`}>
                {running ? '⏸ PAUSE' : '▶ RUN'}
              </button>
              
              <button
                onClick={handleReset}
                className="px-6 py-2 rounded-lg bg-gradient-to-b from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 font-bold shadow-lg">
                RESET
              </button>
              
              {gameMode === 'challenge' && state.time > 60 && (
                <button
                  onClick={endChallenge}
                  className="px-6 py-2 rounded-lg bg-gradient-to-b from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 font-bold shadow-lg">
                  🏁 END CHALLENGE
                </button>
              )}
            </div>
            
            {/* Speed Control */}
            <div className="flex items-center gap-2 bg-black/50 rounded-lg px-3 py-1 border border-gray-700">
              <span className="text-xs text-gray-400">SPEED:</span>
              {[1, 2, 5, 10].map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-3 py-1 rounded text-sm font-bold transition-all ${
                    speed === s 
                      ? 'bg-cyan-600 text-white shadow-lg' 
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}>
                  {s}×{s === 10 && gameMode === 'challenge' ? ' 🎯' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Control Room Layout */}
      <div className="p-4">
        {/* Challenge Objectives Banner */}
        {gameMode === 'challenge' && (
          <>
            <div className="mb-4 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-4 border border-purple-500">
              <h3 className="text-center font-bold text-purple-400 mb-2">🎯 CHALLENGE OBJECTIVES</h3>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className={`${state.totalEnergyMWh >= 375 ? 'bg-green-900/60 border-2 border-green-400' : 'bg-black/40'} rounded p-2 text-center transition-all`}>
                  <div className="text-green-400 font-bold">⚡ Maximize Energy</div>
                  <div className="text-xs text-gray-400">Target: 375+ MWh</div>
                  {state.totalEnergyMWh >= 375 && <div className="text-xs text-green-300 mt-1">✓ Complete!</div>}
                </div>
                <div className={`${capacityFactor >= 90 ? 'bg-purple-900/60 border-2 border-purple-400' : 'bg-black/40'} rounded p-2 text-center transition-all`}>
                  <div className="text-purple-400 font-bold">📊 High Capacity</div>
                  <div className="text-xs text-gray-400">Target: 90%+ Factor</div>
                  {capacityFactor >= 90 && <div className="text-xs text-purple-300 mt-1">✓ Complete!</div>}
                </div>
                <div className={`${peakPower >= 250 ? 'bg-blue-900/60 border-2 border-blue-400' : 'bg-black/40'} rounded p-2 text-center transition-all`}>
                  <div className="text-blue-400 font-bold">🚀 Peak Power</div>
                  <div className="text-xs text-gray-400">Reach 250 MW Safely</div>
                  {peakPower >= 250 && <div className="text-xs text-blue-300 mt-1">✓ Complete!</div>}
                </div>
                <div className={`${tripCount === 0 ? 'bg-yellow-900/60 border-2 border-yellow-400' : 'bg-black/40'} rounded p-2 text-center transition-all`}>
                  <div className="text-yellow-400 font-bold">🛡️ Zero Trips</div>
                  <div className="text-xs text-gray-400">No SCRAM Events</div>
                  {tripCount === 0 && state.time > 60 && <div className="text-xs text-yellow-300 mt-1">✓ Perfect!</div>}
                  {tripCount > 0 && <div className="text-xs text-red-400 mt-1">✗ {tripCount} trips</div>}
                </div>
              </div>
            </div>
            
            <StrategyTips show={showTips} onToggle={() => setShowTips(!showTips)} />
          </>
        )}
        
        {/* Top Row - Key Indicators */}
        <div className="grid grid-cols-6 gap-4 mb-4">
          <DigitalDisplay 
            value={state.thermalPower} 
            label="THERMAL POWER" 
            unit="MW"
            warning={state.thermalPower > 255}
            critical={state.thermalPower > 285}
          />
          <DigitalDisplay 
            value={state.keff} 
            label="K-EFFECTIVE" 
            unit=""
            decimals={5}
            warning={state.keff > 1.005}
            critical={state.keff > 1.01}
          />
          <DigitalDisplay 
            value={state.period === Infinity ? 9999 : Math.abs(state.period)} 
            label="PERIOD" 
            unit="sec"
            warning={state.period > 0 && state.period < 60}
            critical={state.period > 0 && state.period < 30}
          />
          <DigitalDisplay 
            value={state.startupRate} 
            label="STARTUP RATE" 
            unit="DPM"
            warning={Math.abs(state.startupRate) > 0.5}
            critical={Math.abs(state.startupRate) > 1.0}
          />
          <DigitalDisplay 
            value={state.fuelTemp} 
            label="FUEL TEMP" 
            unit="°C"
            warning={state.fuelTemp > 700}
            critical={state.fuelTemp > 740}
          />
          <DigitalDisplay 
            value={state.coolantTemp} 
            label="COOLANT TEMP" 
            unit="°C"
            warning={state.coolantTemp > 680}
            critical={state.coolantTemp > 720}
          />
        </div>
        
        {/* Middle Section - Main Controls and Displays */}
        <div className="grid grid-cols-12 gap-4 mb-4">
          {/* Left - Analog Gauges */}
          <div className="col-span-3 grid grid-cols-2 gap-2">
            <AnalogGauge 
              value={state.thermalPower} 
              min={0} 
              max={300} 
              label="POWER" 
              unit="MW"
              yellowZone={[240, 280]}
              redZone={[280, 300]}
              size={140}
            />
            <AnalogGauge 
              value={state.neutronDensity * 1e6} 
              min={0} 
              max={1000000} 
              label="NEUTRON FLUX" 
              unit=""
              size={140}
            />
            <AnalogGauge 
              value={state.fuelTemp} 
              min={500} 
              max={800} 
              label="FUEL °C" 
              unit=""
              yellowZone={[700, 740]}
              redZone={[740, 800]}
              size={140}
            />
            <AnalogGauge 
              value={state.totalReactivity} 
              min={-500} 
              max={500} 
              label="REACTIVITY" 
              unit="pcm"
              size={140}
            />
          </div>
          
          {/* Center - Control Panel */}
          <div className="col-span-3">
            <ControlPanel 
              reactor={state}
              onRodMove={handleRodMove}
              onScram={handleScram}
            />
          </div>
          
          {/* Right - Status and Alarms */}
          <div className="col-span-3 space-y-4">
            <StatusPanel reactor={state} />
            <AlarmPanel alarms={state.alarms} />
          </div>
          
          {/* Far Right - Strip Charts */}
          <div className="col-span-3 space-y-2">
            <StripChart 
              data={state.history} 
              dataKey="power" 
              label="Power History (MW)" 
              color="#10b981"
              height={80}
            />
            <StripChart 
              data={state.history} 
              dataKey="keff" 
              label="K-effective" 
              color="#3b82f6"
              height={80}
            />
            <StripChart 
              data={state.history} 
              dataKey="fuelTemp" 
              label="Fuel Temp (°C)" 
              color="#f59e0b"
              height={80}
            />
            <StripChart 
              data={state.history} 
              dataKey="totalReactivity" 
              label="Total Reactivity (pcm)" 
              color="#a855f7"
              height={80}
            />
          </div>
        </div>
        
        {/* Bottom - Reactivity Balance Display */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
          <h3 className="text-center font-bold text-purple-400 mb-3">REACTIVITY BALANCE</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-400">Rod Worth</div>
              <div className="text-2xl font-mono font-bold text-blue-400">
                {state.rodReactivity > 0 ? '+' : ''}{state.rodReactivity.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">pcm</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Temperature</div>
              <div className="text-2xl font-mono font-bold text-orange-400">
                {state.tempReactivity > 0 ? '+' : ''}{state.tempReactivity.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">pcm</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Xenon</div>
              <div className="text-2xl font-mono font-bold text-purple-400">
                {state.xenonReactivity > 0 ? '+' : ''}{state.xenonReactivity.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">pcm</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Total</div>
              <div className={`text-3xl font-mono font-bold ${
                Math.abs(state.totalReactivity) > 200 ? 'text-red-400' :
                Math.abs(state.totalReactivity) > 100 ? 'text-amber-400' :
                'text-green-400'
              }`}>
                {state.totalReactivity > 0 ? '+' : ''}{state.totalReactivity.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">pcm</div>
            </div>
          </div>
        </div>
        
        {/* Session Statistics Panel */}
        <div className="mt-4 bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-lg p-4 border border-green-600/50">
          <h3 className="text-center font-bold text-green-400 mb-3">
            {gameMode === 'challenge' ? 'CHALLENGE STATISTICS' : 'SESSION STATISTICS'}
          </h3>
          <div className={`grid ${gameMode === 'challenge' ? 'grid-cols-6' : 'grid-cols-5'} gap-4 text-center`}>
            <div className="bg-black/40 rounded p-3">
              <div className="text-xs text-gray-400">Total Energy Generated</div>
              <div className="text-3xl font-mono font-bold text-green-400">
                {state.totalEnergyMWh.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">MWh</div>
            </div>
            <div className="bg-black/40 rounded p-3">
              <div className="text-xs text-gray-400">Peak Power</div>
              <div className="text-3xl font-mono font-bold text-yellow-400">
                {peakPower.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">MW</div>
            </div>
            <div className="bg-black/40 rounded p-3">
              <div className="text-xs text-gray-400">Capacity Factor</div>
              <div className="text-3xl font-mono font-bold text-purple-400">
                {capacityFactor.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">%</div>
            </div>
            <div className="bg-black/40 rounded p-3">
              <div className="text-xs text-gray-400">Average Power</div>
              <div className="text-3xl font-mono font-bold text-blue-400">
                {state.time > 0 ? (state.totalEnergyMWh / (state.time / 3600)).toFixed(1) : '0.0'}
              </div>
              <div className="text-sm text-gray-500">MW</div>
            </div>
            <div className="bg-black/40 rounded p-3">
              <div className="text-xs text-gray-400">Operating Time</div>
              <div className="text-3xl font-mono font-bold text-cyan-400">
                {Math.floor(state.time / 60)}:{(Math.floor(state.time) % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-sm text-gray-500">min:sec</div>
            </div>
            {gameMode === 'challenge' && (
              <div className="bg-black/40 rounded p-3">
                <div className="text-xs text-gray-400">Safety Record</div>
                <div className="text-3xl font-mono font-bold text-red-400">
                  {tripCount}
                </div>
                <div className="text-sm text-gray-500">Reactor Trips</div>
                <div className="text-xs text-gray-600 mt-1">-10 pts each</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Game Over Modal */}
      {showGameOver && finalScore && (
        <GameOverModal 
          score={finalScore} 
          onRestart={handleNewChallenge}
          onClose={handleGameOverClose}
        />
      )}
    </div>
  );
}