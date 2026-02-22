import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { PieChart } from "react-native-chart-kit";
import FlashMessage, { showMessage } from "react-native-flash-message";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { supabase } from "../../lib/supabase";

const screenWidth = Dimensions.get("window").width;

// UPDATED CATEGORIES AS REQUESTED
const BUDGET_CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Etc."];

const budgetTips = [
  "💡 Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings",
  "🎯 Set up automatic transfers to your goals on payday",
  "📊 Review your spending weekly to stay on track",
  "🍽️ Meal planning can save you 20-30% on food costs",
];

const EmptyState = ({ icon, title, description, onAction }: any) => (
  <View style={styles.emptyStateContainer}>
    <View style={styles.emptyIconCircle}>
      <MaterialCommunityIcons name={icon} size={40} color="#3A6B55" />
    </View>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    <Text style={styles.emptyStateDescription}>{description}</Text>
    <TouchableOpacity style={styles.emptyStateButton} onPress={onAction}>
      <Text style={styles.emptyStateButtonText}>+ Add Now</Text>
    </TouchableOpacity>
  </View>
);

export default function BudgetPlannerScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [income, setIncome] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [monthlyTip, setMonthlyTip] = useState("");

  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalProgress, setGoalProgress] = useState("0");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [goalCategory, setGoalCategory] = useState("Etc.");

  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetCategory, setBudgetCategory] = useState("Food");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetEndDate, setBudgetEndDate] = useState("");

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setOverviewLoading(true);
      setChartLoading(true);
      setGoalsLoading(true);
      setBudgetsLoading(true);
      fetchData();
      setMonthlyTip(budgetTips[new Date().getMonth() % budgetTips.length]);
    }, [])
  );

  const fetchData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");

      const [incRes, budRes, expRes, goalRes] = await Promise.all([
        supabase.from("income").select("*").eq("user_id", session.user.id),
        supabase
          .from("budgets")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("user_id", session.user.id),
        supabase
          .from("goals")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
      ]);

      setIncome(incRes.data || []);
      setBudgets(budRes.data || []);
      setExpenses(expRes.data || []);
      setGoals(goalRes.data || []);

      setTimeout(() => setOverviewLoading(false), 400);
      setTimeout(() => setChartLoading(false), 700);
      setTimeout(() => setGoalsLoading(false), 1000);
      setTimeout(() => setBudgetsLoading(false), 1300);
    } catch (error: any) {
      showMessage({ message: error.message, type: "danger" });
    } finally {
      setRefreshing(false);
    }
  };

  const totalPlannedIncome = income.reduce(
    (acc, curr) => acc + Number(curr.amount),
    0
  );
  const totalAllocated = budgets.reduce(
    (acc, curr) => acc + Number(curr.amount),
    0
  );
  const totalActualSpent = expenses.reduce(
    (acc, curr) => acc + Number(curr.amount),
    0
  );

  const totalBalance = totalPlannedIncome - totalActualSpent;
  const spendingRate =
    totalAllocated > 0
      ? Math.round((totalActualSpent / totalAllocated) * 100)
      : 0;

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      Food: "#3A6B55",
      Transport: "#F2994A",
      Bills: "#2D9CDB",
      Shopping: "#EB5757",
      Etc: "#9B51E0",
    };
    return colors[cat] || "#999";
  };

  const getPieChartData = () =>
    budgets.map((b) => ({
      name: b.category,
      amount: Number(b.amount),
      color: getCategoryColor(b.category),
      legendFontColor: "#333",
    }));

  const handleSaveGoal = async () => {
    if (!goalTitle) return Alert.alert("Error", "Title is required");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const progressInt = parseInt(goalProgress) || 0;
    const payload = {
      user_id: user?.id,
      title: goalTitle,
      progress_ratio: progressInt,
      deadline: goalDeadline || null,
      category: goalCategory,
      is_completed: progressInt >= 100,
    };

    const { error } = editingGoalId
      ? await supabase.from("goals").update(payload).eq("id", editingGoalId)
      : await supabase.from("goals").insert([payload]);

    if (!error) {
      setGoalModalVisible(false);
      fetchData();
      resetGoalForm();
    }
  };

  const handleSaveBudget = async () => {
    if (!budgetAmount) return Alert.alert("Error", "Amount is required");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const payload = {
      user_id: user?.id,
      category: budgetCategory,
      amount: parseFloat(budgetAmount),
      period: "monthly",
      end_date: budgetEndDate || null,
    };

    const { error } = editingBudgetId
      ? await supabase.from("budgets").update(payload).eq("id", editingBudgetId)
      : await supabase.from("budgets").insert([payload]);

    if (!error) {
      setBudgetModalVisible(false);
      fetchData();
      resetBudgetForm();
    }
  };

  const resetGoalForm = () => {
    setEditingGoalId(null);
    setGoalTitle("");
    setGoalProgress("0");
    setGoalDeadline("");
    setGoalCategory("Etc.");
  };

  const resetBudgetForm = () => {
    setEditingBudgetId(null);
    setBudgetCategory("Food");
    setBudgetAmount("");
    setBudgetEndDate("");
  };

  const renderSwipeActions = (
    id: string,
    table: "goals" | "budgets",
    item: any
  ) => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: "#FFA726" }]}
        onPress={() => {
          if (table === "goals") {
            setEditingGoalId(id);
            setGoalTitle(item.title);
            setGoalProgress(item.progress_ratio.toString());
            setGoalDeadline(item.deadline);
            setGoalModalVisible(true);
          } else {
            setEditingBudgetId(id);
            setBudgetCategory(item.category);
            setBudgetAmount(item.amount.toString());
            setBudgetEndDate(item.end_date);
            setBudgetModalVisible(true);
          }
        }}
      >
        <MaterialCommunityIcons name="pencil" size={22} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: "#EF5350" }]}
        onPress={() => {
          Alert.alert(
            "Confirm Delete",
            `Are you sure you want to delete this ${
              table === "goals" ? "goal" : "budget"
            }?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  const { error } = await supabase
                    .from(table)
                    .delete()
                    .eq("id", id);
                  if (error) {
                    showMessage({ message: error.message, type: "danger" });
                  } else {
                    fetchData();
                    showMessage({
                      message: "Deleted successfully",
                      type: "success",
                    });
                  }
                },
              },
            ]
          );
        }}
      >
        <MaterialCommunityIcons name="delete" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchData} />
          }
        >
          <View style={styles.tipCard}>
            <MaterialCommunityIcons
              name="lightbulb-on"
              size={24}
              color="#F2994A"
            />
            <Text style={styles.tipText}>{monthlyTip}</Text>
          </View>

          <View style={styles.overviewCard}>
            {overviewLoading ? (
              <ActivityIndicator color="#3A6B55" size="large" />
            ) : (
              <>
                <View style={styles.topDashboardRow}>
                  <View style={styles.dashboardHeader}>
                    {/* Main Balance Display */}
                    <View style={styles.balanceContainer}>
                      <Text style={styles.balanceLabel}>Total Balance</Text>
                      <Text
                        style={[
                          styles.balanceValue,
                          { color: totalBalance >= 0 ? "#3A6B55" : "#EB5757" },
                        ]}
                      >
                        ₱{totalBalance.toLocaleString()}
                      </Text>
                    </View>

                    {/* Sub-stats Row */}
                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <MaterialCommunityIcons
                          name="trending-up"
                          size={16}
                          color="#3A6B55"
                        />
                        <View style={{ marginLeft: 8 }}>
                          <Text style={styles.statLabel}>Income</Text>
                          <Text style={styles.statValue}>
                            ₱{totalPlannedIncome.toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.statDivider} />

                      <View style={styles.statBox}>
                        <MaterialCommunityIcons
                          name="trending-down"
                          size={16}
                          color="#EB5757"
                        />
                        <View style={{ marginLeft: 8 }}>
                          <Text style={styles.statLabel}>Spent</Text>
                          <Text style={styles.statValue}>
                            ₱{totalActualSpent.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Budget Burn Rate</Text>
                    <Text style={styles.progressPercent}>{spendingRate}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(spendingRate, 100)}%`,
                          backgroundColor:
                            spendingRate > 90 ? "#EB5757" : "#3A6B55",
                        },
                      ]}
                    />
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Budget Allocation</Text>
            {chartLoading ? (
              <ActivityIndicator color="#3A6B55" style={{ height: 180 }} />
            ) : budgets.length === 0 ? (
              <View style={styles.emptyChartState}>
                <MaterialCommunityIcons
                  name="chart-arc"
                  size={50}
                  color="#E2E8F0"
                />
                <Text style={styles.miniLabel}>No data yet</Text>
              </View>
            ) : (
              <PieChart
                data={getPieChartData()}
                width={screenWidth - 60}
                height={180}
                chartConfig={{ color: (o = 1) => `rgba(0,0,0,${o})` }}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Savings Goals</Text>
            <TouchableOpacity
              onPress={() => {
                resetGoalForm();
                setGoalModalVisible(true);
              }}
            >
              <MaterialCommunityIcons
                name="plus-circle"
                size={28}
                color="#3A6B55"
              />
            </TouchableOpacity>
          </View>

          {goalsLoading ? (
            <ActivityIndicator color="#3A6B55" />
          ) : goals.length === 0 ? (
            <EmptyState
              icon="target"
              title="Set a Goal"
              description="Track your savings for big purchases."
              onAction={() => setGoalModalVisible(true)}
            />
          ) : (
            goals.map((goal) => (
              <Swipeable
                key={goal.id}
                renderRightActions={() =>
                  renderSwipeActions(goal.id, "goals", goal)
                }
              >
                <View style={styles.planCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>{goal.title}</Text>
                    <Text style={styles.planSubtitle}>
                      Due: {goal.deadline || "No date"}
                    </Text>
                    <View style={styles.miniProgressBarBg}>
                      <View
                        style={[
                          styles.miniProgressBarFill,
                          { width: `${goal.progress_ratio}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.planAmount}>{goal.progress_ratio}%</Text>
                </View>
              </Swipeable>
            ))
          )}

          <View style={[styles.sectionHeader, { marginTop: 30 }]}>
            <Text style={styles.sectionTitle}>Expense Limits</Text>
            <TouchableOpacity
              onPress={() => {
                resetBudgetForm();
                setBudgetModalVisible(true);
              }}
            >
              <MaterialCommunityIcons
                name="plus-circle"
                size={28}
                color="#3A6B55"
              />
            </TouchableOpacity>
          </View>

          {budgetsLoading ? (
            <ActivityIndicator color="#3A6B55" />
          ) : budgets.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="Create Budget"
              description="Control your monthly spending categories."
              onAction={() => setBudgetModalVisible(true)}
            />
          ) : (
            budgets.map((b) => (
              <Swipeable
                key={b.id}
                renderRightActions={() =>
                  renderSwipeActions(b.id, "budgets", b)
                }
              >
                <View
                  style={[
                    styles.planCard,
                    { borderLeftColor: getCategoryColor(b.category) },
                  ]}
                >
                  <View>
                    <Text style={styles.planTitle}>{b.category}</Text>
                    <Text style={styles.planSubtitle}>Cycle: {b.period}</Text>
                  </View>
                  <Text style={styles.planAmount}>
                    ₱{Number(b.amount).toLocaleString()}
                  </Text>
                </View>
              </Swipeable>
            ))
          )}
        </ScrollView>

        {/* Goal Modal with Labels */}
        <Modal visible={goalModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                {editingGoalId ? "Update Goal" : "New Savings Goal"}
              </Text>

              <Text style={styles.fieldLabel}>Goal Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. New Laptop"
                value={goalTitle}
                onChangeText={setGoalTitle}
              />

              <Text style={styles.fieldLabel}>Current Progress (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="0 - 100"
                keyboardType="numeric"
                value={goalProgress}
                onChangeText={setGoalProgress}
              />

              <Text style={styles.fieldLabel}>Target Deadline</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={goalDeadline}
                onChangeText={setGoalDeadline}
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveGoal}
              >
                <Text style={styles.saveButtonText}>Save Goal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setGoalModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Budget Modal with Labels and Your Specific Categories */}
        <Modal visible={budgetModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                {editingBudgetId ? "Update Budget" : "New Expense Limit"}
              </Text>

              <Text style={styles.fieldLabel}>Select Category</Text>
              <View style={styles.categoryContainer}>
                {BUDGET_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      budgetCategory === cat && {
                        backgroundColor: getCategoryColor(cat),
                      },
                    ]}
                    onPress={() => setBudgetCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        budgetCategory === cat && { color: "#fff" },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Monthly Limit (₱)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={budgetAmount}
                onChangeText={setBudgetAmount}
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveBudget}
              >
                <Text style={styles.saveButtonText}>Save Budget</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBudgetModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <FlashMessage position="top" />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 100 },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#E0E0E0",
  },
  categoryChipText: { fontSize: 12, fontWeight: "500", color: "#666" },
  tipCard: {
    backgroundColor: "#FFF9E6",
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FFE082",
  },
  tipText: { flex: 1, marginLeft: 12, fontSize: 14, color: "#5D4037" },
  overviewCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  topDashboardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  dashboardHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  balanceContainer: {
    alignItems: "center",
    paddingVertical: 15,
  },
  balanceLabel: {
    fontSize: 13,
    color: "#718096",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: "800",
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#F8FAFB",
    borderRadius: 16,
    padding: 15,
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDF2F7",
  },
  statBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#718096",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2D3748",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E2E8F0",
  },
  dashboardColumn: { flex: 1 },
  rightColumn: { alignItems: "flex-end" },
  miniLabel: { fontSize: 12, color: "#888" },
  miniValue: { fontSize: 14, fontWeight: "700" },
  overviewLabel: { fontSize: 12, color: "#666" },
  overviewValue: { fontSize: 24, fontWeight: "bold", color: "#3A6B55" },
  progressSection: { marginTop: 10 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  progressLabel: { fontSize: 12, color: "#666" },
  progressPercent: { fontSize: 12, fontWeight: "bold" },
  progressBarBg: {
    height: 8,
    backgroundColor: "#E8F5E9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%" },
  chartCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: "center",
    minHeight: 220,
    justifyContent: "center",
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  planCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 5,
    borderLeftColor: "#3A6B55",
    elevation: 2,
  },
  planTitle: { fontSize: 15, fontWeight: "600" },
  planSubtitle: { fontSize: 11, color: "#999" },
  planAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3A6B55",
    marginLeft: 10,
  },
  miniProgressBarBg: {
    height: 4,
    backgroundColor: "#EEE",
    borderRadius: 2,
    marginTop: 8,
    width: "80%",
  },
  miniProgressBarFill: { height: "100%", backgroundColor: "#3A6B55" },
  swipeActions: { flexDirection: "row", width: 120, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 8,
    marginTop: 5,
    paddingLeft: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F8FAFB",
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  saveButton: {
    backgroundColor: "#3A6B55",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: { color: "#fff", fontWeight: "bold" },
  cancelText: { textAlign: "center", marginTop: 15, color: "#888" },
  emptyStateContainer: {
    padding: 30,
    backgroundColor: "#fff",
    borderRadius: 20,
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#CBD5E0",
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: "#718096",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: "#3A6B55",
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 12,
  },
  emptyStateButtonText: { color: "#fff", fontWeight: "bold" },
  emptyChartState: {
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
});
