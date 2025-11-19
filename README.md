# Nuclear Reactor Physics & Operations Simulator

Interactive, browser-based simulator that lets students and enthusiasts explore nuclear reactor neutronics, thermal-hydraulics, control rods, xenon transients, and basic operations in a safe, gamified environment. :contentReference[oaicite:0]{index=0}  

> ⚠️ **Important**  
> This is an **educational** tool that illustrates qualitative reactor behavior.  
> It is **not** plant specific, **not** safety qualified, and must **never** be used for real-world operations or certified operator training.

---

## ✨ Key Features

- **Advanced point-kinetics core model**
  - Delayed neutron precursors (6 groups)
  - Reactivity feedback from control rods, fuel temperature, and xenon
  - Neutron density and k-effective tracking
- **Thermal-hydraulic loop**
  - Fuel and coolant temperatures
  - Heat transfer and basic cooling response
- **Fission product poisoning**
  - Iodine and xenon buildup and decay
  - Xenon reactivity worth and burnup
- **Game-like operations panel**
  - Multi-step control rod movement (10%, 1%, 0.5%, 0.1%)
  - Emergency SCRAM button
  - Status lights and alarm panel
- **Gamified challenge mode**
  - 100-minute simulated run (about 10 minutes at 10× speed)
  - Scoring based on energy, capacity factor, peak power, and safety record
- **Rich operator UI**
  - Digital indicators (power, temp, k-effective, period, startup rate)
  - Analog gauges and strip charts
  - Reactivity balance and session statistics

---

## 🧠 Simulation Model

The simulator uses a simplified but rich model that includes:

- **Neutronics**
  - Total delayed neutron fraction `BETA_TOTAL`
  - Prompt generation time `GENERATION_TIME`
  - External neutron source term
  - Six delayed neutron precursor groups
- **Reactivity components**
  - Control rod worth curve with a critical point and separate positive/negative regions
  - Fuel Doppler coefficient and moderator temperature coefficient
  - Xenon worth based on a normalized xenon concentration
- **Thermal response**
  - Fuel and coolant heat capacities
  - Heat transfer from fuel to coolant
  - Cooling based on power level and temperature
- **Poison dynamics**
  - Iodine production from fission, decay to xenon
  - Xenon decay and burnup under flux

All numerical values are in **normalized or arbitrary units** and tuned for teaching, not for real-plant fidelity.

---

## 🎮 Game Modes

### Sandbox Mode

Freeform exploration mode:

- Start from a shutdown core
- Move rods in and out to:
  - Approach criticality
  - Bring the reactor to power
  - Explore xenon, temperature, and reactivity feedback
- Watch:
  - Power, k-effective, temperatures, and reactivity over time
  - Total energy produced (MWh), capacity factor, and peak power

### Challenge Mode

Timed, score-based scenario:

- **Duration**: 100 simulated minutes (about 10 minutes at 10× speed)
- **Objectives**:
  - Generate **375+ MWh** of energy
  - Achieve **90%+ capacity factor**
  - Reach **250 MW** peak power safely
  - Avoid SCRAM trips for a safety bonus
- **Scoring components**:
  - Energy score
  - Capacity factor score
  - Peak power score
  - Penalty for each SCRAM
  - Bonus for zero trips

An end-of-run modal shows grade, breakdown, and best score.

---

## 🖥️ UI Overview

The main control room layout includes:

- **Top row digital indicators**
  - Thermal power (MW)
  - K-effective
  - Period (seconds)
  - Startup rate (DPM)
  - Fuel temperature and coolant temperature
- **Analog gauges**
  - Power
  - Neutron flux
  - Fuel temperature
  - Total reactivity (pcm)
- **Control rod system**
  - Visual rod bank display
  - Current vs target position
  - Buttons for fast, slow, fine, and ultrafine steps
- **Status and alarms**
  - LED indicators: critical, power range, short period, SCRAM, rod limits, high reactivity, high temperature
  - Alarm panel with advisory, warning, and trip messages and ACK button
- **Strip chart recorders**
  - Power
  - K-effective
  - Fuel temperature
  - Total reactivity
- **Reactivity balance**
  - Rod worth
  - Temperature feedback
  - Xenon worth
  - Total reactivity, color coded by magnitude
- **Session statistics**
  - Total energy (MWh)
  - Peak power
  - Capacity factor
  - Average power
  - Operating time
  - Trip count in challenge mode

---

## 🎛 Controls

### Simulation

- **Run / Pause**: Start or pause the time integration
- **Reset**: Reset the simulator to its initial state
- **Speed**: Choose from `1×`, `2×`, `5×`, or `10×` time acceleration

### Rod Control

All rod commands move the **target** rod position; motion is smoothed by a maximum speed:

- **↑↑↑ FAST 10%**: Withdraw rods by 10%
- **↓↓↓ FAST 10%**: Insert rods by 10%
- **↑↑ WITHDRAW 1%**: Withdraw rods by 1%
- **↓↓ INSERT 1%**: Insert rods by 1%
- **↑ ULTRA 0.1%**: Withdraw rods by 0.1%
- **↓ ULTRA 0.1%**: Insert rods by 0.1%

### SCRAM

- **Emergency SCRAM**:
  - Sets rods to drive fully in
  - Trips the reactor to a SCRAM state
  - Stops the simulation run

---

## 🧪 Educational Uses

This project is designed to help learners:

- Build intuition about:
  - Criticality and k-effective
  - Delayed neutrons and periods
  - Temperature feedback and inherent stability
  - Xenon transients and poisoning
- Practice qualitative operator thinking:
  - How to bring a reactor to power steadily
  - How to avoid short periods and power overshoots
  - How long-term xenon and temperature dynamics affect control
- Experience tradeoffs:
  - Maximizing energy vs protecting safety limits
  - Balancing rod movements, feedback, and operational goals

It is suitable as a **companion tool** for undergraduate nuclear engineering courses, operator introductory workshops, or self-study for technically inclined learners.
