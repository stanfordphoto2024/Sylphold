import sys
import re

path = '/Users/sylphold/Documents/trae_projects/Sylphold Web/src/App.tsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Replace Dashboard Stats and Control Buttons
new_dashboard_content = """
                <div className="flex flex-col gap-3 sm:gap-4">
                  <DashboardStats
                    totalOrders={totalOrders}
                    activeOrders={activeOrders}
                    completedOrders={completedOrders}
                    activeHelpersCount={helperSim?.activeHelpers?.length || 0}
                    totalHelpersCount={helpers.length}
                    isHelperSimRunning={helperSim?.running || false}
                    autoSim={autoSim}
                  />
                  <ControlButtons
                    onCreateBatchOrders={createBatchOrders}
                    onAdvanceOrders={advanceOrders}
                    onToggleAutoSim={() => setAutoSim((value) => !value)}
                    autoSim={autoSim}
                    onResetOrders={resetOrders}
                    onToggleHelperSim={helperSim?.toggleRunning || (() => {})}
                    isHelperSimRunning={helperSim?.running || false}
                    onToggleStressTest={() => setStressTestMode((value) => !value)}
                    stressTestMode={stressTestMode}
                    onToggleHomeMode={() => setHomeMode((value) => !value)}
                    homeMode={homeMode}
                    onToggleLaundryFailure={() => setLaundryFailureMode((value) => !value)}
                    laundryFailureMode={laundryFailureMode}
                  />
"""

# Targeted replacement for the control panel grid and buttons
pattern = re.compile(r'<div className="grid grid-cols-3 gap-2 sm:gap-3">.*?</div>\s+<div className="flex flex-wrap gap-2 sm:gap-3">.*?</div>', re.DOTALL)
content = pattern.sub(new_dashboard_content.strip(), content)

# 2. Replace Decision Center
new_decision_center = """
                <DecisionCenter
                  decisionPhase={decisionPhase}
                  decisionStateLabel={decisionStateLabel}
                  onGenerateOrder={handleGenerateSimulationOrder}
                  activeOrders={activeOrders}
                  totalOrders={totalOrders}
                  completedOrders={completedOrders}
                  flashMetrics={flashMetrics}
                  ecoMetrics={ecoMetrics}
                  premiumMetrics={premiumMetrics}
                  lowestGuaranteePlanId={lowestGuaranteePlanId}
                  premiumTrustScore={premiumTrustScore}
                  planMetrics={planMetrics}
                  bestPlan={bestPlan}
                  onStartSimulation={startSimulation}
                  selectedPlan={selectedPlan}
                  laundryLocations={laundryLocations}
                  vehicles={vehicles}
                  houseClients={houseClients}
                  helpers={helpers}
                  planHistory={planHistory}
                />
"""

decision_panel_pattern = re.compile(r'<GlassPanel title="DECISION CENTER" subtitle="AI ROUTING ENGINE">.*?</GlassPanel>', re.DOTALL)
replacement_decision_panel = f'<GlassPanel title="DECISION CENTER" subtitle="AI ROUTING ENGINE">{new_decision_center}</GlassPanel>'
content = decision_panel_pattern.sub(replacement_decision_panel, content)

with open(path, 'w') as f:
    f.write(content)
