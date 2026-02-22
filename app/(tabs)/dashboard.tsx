import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { supabase } from "../../lib/supabase";

const screenWidth = Dimensions.get("window").width;
const BUDGET_CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Etc."];

export default function DashboardScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const isFocused = useIsFocused();

  // Loading States
  const [loading, setLoading] = useState(true);
  const [nameLoading, setNameLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gastosLoading, setGastosLoading] = useState(true);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [recentIncome, setRecentIncome] = useState<any[]>([]);

  // Expansion States
  const [showAllIncome, setShowAllIncome] = useState(false);
  const [showAllGastos, setShowAllGastos] = useState(false);

  // Data States
  const [profile, setProfile] = useState<any>(null);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, balance: 0 });
  const [budgetTotal, setBudgetTotal] = useState(0);
  const [categoryBudgets, setCategoryBudgets] = useState<any[]>([]);
  const [monthlyCategoryTotals, setMonthlyCategoryTotals] = useState<any>({});
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [weeklySpending, setWeeklySpending] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [selectedWeekPoint, setSelectedWeekPoint] = useState<{
    value: number;
    day: string;
  } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{
    value: number;
    label: string;
  } | null>(null);

  // Helper for Gastos Icons
  const getCategoryIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes("food")) return "food-apple";
    if (c.includes("trans")) return "bus-side";
    if (c.includes("bill")) return "lightning-bolt";
    if (c.includes("shopping")) return "cart";
    return "cash-minus";
  };

  // Helper for Income Icons
  const getIncomeIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes("salary")) return "cash-check";
    if (c.includes("business")) return "storefront";
    if (c.includes("freelance")) return "laptop";
    if (c.includes("gift")) return "gift";
    return "plus-circle-outline";
  };

  const getBalanceStatus = () => {
    const { income, expenses, balance } = totals;
    if (income === 0 && expenses === 0) {
      return {
        msg: "Ano pa inaantay mo? Simulan mo na! 💰",
        icon: "emoticon-outline",
        color: "#fff",
      };
    }
    if (balance <= 0 && income > 0) {
      return {
        msg: "Hala, wala na! Mag-tipid ka na please. 😤",
        icon: "emoticon-sad",
        color: "#FFB2B0",
      };
    }
    if (balance < income * 0.4) {
      return {
        msg: "Sakto lang pang sarili. Tipid-tipid muna. 😶",
        icon: "emoticon-neutral",
        color: "#FFD700",
      };
    }
    return {
      msg: "Galing! Discipline is key. Keep saving! 🌟",
      icon: "emoticon-happy",
      color: "#85CCAB",
    };
  };

  const status = getBalanceStatus();

  async function fetchDashboardData() {
    setNameLoading(true);
    setBalanceLoading(true);
    setChartLoading(true);
    setGastosLoading(true);
    setIncomeLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/(auth)/login");
        return;
      }

      // 1. SET TIME BOUNDARIES FOR CURRENT MONTH
      const now = new Date();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString();
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59
      ).toISOString();

      console.log("=== FETCHING DASHBOARD DATA ===");
      console.log("Current Month Range:", { startOfMonth, endOfMonth });
      console.log("User ID:", session.user.id);

      const [profRes, incRes, expRes, budRes, monthExpRes, recentIncRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single(),
          supabase
            .from("income")
            .select("amount")
            .eq("user_id", session.user.id),
          supabase
            .from("expenses")
            .select("*")
            .eq("user_id", session.user.id)
            .order("date", { ascending: false }),
          supabase.from("budgets").select("*").eq("user_id", session.user.id),
          // FETCH ALL EXPENSES FOR THE CURRENT MONTH
          supabase
            .from("expenses")
            .select("id, amount, date, category, title")
            .eq("user_id", session.user.id)
            .gte("date", startOfMonth)
            .lte("date", endOfMonth)
            .order("date", { ascending: false }),
          supabase
            .from("income")
            .select("*")
            .eq("user_id", session.user.id)
            .order("date", { ascending: false }),
        ]);

      if (profRes.data) setProfile(profRes.data);
      if (recentIncRes.data) setRecentIncome(recentIncRes.data);

      // 2. CALCULATE OVERALL TOTALS (ALL TIME)
      const totalInc =
        incRes.data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
      const totalExp =
        expRes.data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
      const totalBud =
        budRes.data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

      console.log("Total Income (All Time):", totalInc);
      console.log("Total Expenses (All Time):", totalExp);

      // 3. AGGREGATE EXPENSES BY CATEGORY FOR CURRENT MONTH
      console.log(
        "=== MONTHLY EXPENSES FETCHED ===",
        monthExpRes.data?.length || 0,
        "records"
      );

      const aggregatedCategoryTotals: Record<string, number> = {};

      // Initialize all categories with 0
      BUDGET_CATEGORIES.forEach((cat) => {
        aggregatedCategoryTotals[cat] = 0;
      });

      // Log ALL fetched expenses to verify data
      console.log("=== ALL MONTHLY EXPENSES (RAW DATA) ===");
      monthExpRes.data?.forEach((expense, index) => {
        console.log(`Record ${index + 1}:`, {
          id: expense.id,
          title: expense.title,
          category: expense.category,
          amount: expense.amount,
          date: expense.date,
        });
      });

      // Sum up all expenses per category
      monthExpRes.data?.forEach((expense, index) => {
        const rawCategory = expense.category || "Etc.";

        // Match category case-insensitively
        const matchedCategory = BUDGET_CATEGORIES.find(
          (budgetCat) => budgetCat.toLowerCase() === rawCategory.toLowerCase()
        );

        const normalizedCategory = matchedCategory || "Etc.";
        const expenseAmount = Number(expense.amount) || 0;

        console.log(`Processing Expense #${index + 1}:`, {
          id: expense.id,
          title: expense.title,
          rawCategory,
          normalizedCategory,
          amount: expenseAmount,
          previousTotal: aggregatedCategoryTotals[normalizedCategory],
          newTotal:
            aggregatedCategoryTotals[normalizedCategory] + expenseAmount,
        });

        // AGGREGATE: Add this expense to the category total
        aggregatedCategoryTotals[normalizedCategory] += expenseAmount;
      });

      console.log(
        "=== FINAL AGGREGATED CATEGORY TOTALS (CURRENT MONTH) ===",
        aggregatedCategoryTotals
      );

      // Save aggregated totals to state
      setMonthlyCategoryTotals(aggregatedCategoryTotals);

      // 4. PROCESS WEEKLY SPENDING TREND
      const dailyAmounts = [0, 0, 0, 0, 0, 0, 0];
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 is Sunday
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);

      console.log("=== WEEKLY SPENDING CALCULATION ===");
      console.log("This week starts (Monday):", monday.toISOString());

      expRes.data?.forEach((exp) => {
        const expDate = new Date(exp.date);
        if (expDate >= monday) {
          const dayIdx = expDate.getDay() === 0 ? 6 : expDate.getDay() - 1;
          if (dayIdx >= 0 && dayIdx < 7) {
            dailyAmounts[dayIdx] += Number(exp.amount);
            console.log(`Added ₱${exp.amount} to day ${dayIdx} (${exp.title})`);
          }
        }
      });

      console.log("Weekly spending by day:", dailyAmounts);

      // 5. UPDATE ALL STATES
      setCategoryBudgets(budRes.data || []);
      setWeeklySpending(dailyAmounts);
      setTotals({
        income: totalInc,
        expenses: totalExp,
        balance: totalInc - totalExp,
      });
      setBudgetTotal(totalBud);
      setRecentTransactions(expRes.data || []);

      console.log("=== DASHBOARD DATA UPDATED ===");
    } catch (error) {
      console.error("Dashboard Fetch Error:", error);
    } finally {
      setNameLoading(false);
      setBalanceLoading(false);
      setChartLoading(false);
      setIncomeLoading(false);
      setGastosLoading(false);
      setLoading(false);
    }
  }

  // 6. GENERATE CHART DATA - BUDGET LIMITS VS MONTHLY TOTALS
  const generateBudgetChartData = () => {
    if (categoryBudgets.length === 0) {
      return {
        labels: ["None"],
        datasets: [{ data: [0] }, { data: [0] }],
        legend: ["Limit", "Spent"],
      };
    }

    // Get labels from budget categories
    const chartLabels = categoryBudgets.map((budget) =>
      budget.category.substring(0, 4)
    );

    // Budget limits set by user
    const budgetLimits = categoryBudgets.map(
      (budget) => Number(budget.amount) || 0
    );

    // Total spent per category THIS MONTH
    const totalSpentPerCategory = categoryBudgets.map((budget) => {
      const categoryName = budget.category;
      const totalSpent = monthlyCategoryTotals[categoryName] || 0;
      return totalSpent;
    });

    console.log("=== CHART DATA ===");
    console.log("Labels:", chartLabels);
    console.log("Budget Limits:", budgetLimits);
    console.log("Total Spent (Monthly):", totalSpentPerCategory);

    return {
      labels: chartLabels,
      datasets: [
        {
          data: budgetLimits,
          color: (opacity = 1) => `rgba(58, 107, 85, ${opacity})`, // Green - Budget Limit
        },
        {
          data: totalSpentPerCategory,
          color: (opacity = 1) => `rgba(212, 131, 128, ${opacity})`, // Red - Total Spent
        },
      ],
      legend: ["Limit", "Total Spent"],
    };
  };

  const getCategoryLogo = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes("food")) return "food-outline";
    if (c.includes("trans")) return "bus-side";
    if (c.includes("bill")) return "lightning-bolt-outline";
    if (c.includes("shopping")) return "cart-outline";
    return "dots-horizontal-circle-outline";
  };

  useEffect(() => {
    if (isFocused) {
      fetchDashboardData();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [isFocused]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#3A6B55" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3A6B55"
          />
        }
      >
        <View style={styles.greetingSection}>
          {nameLoading ? (
            <View style={styles.nameLoaderRow}>
              <ActivityIndicator size="small" color="#3A6B55" />
              <Text style={styles.loadingNameText}>Identifying user...</Text>
            </View>
          ) : (
            <Text style={styles.greetingText}>
              Hello, {profile?.full_name?.split(" ")[0] || "User"}! 👋
            </Text>
          )}
          <Text style={styles.subtitle}>Track your money easily.</Text>
        </View>

        {/* Total Balance Card */}
        <View style={styles.mainCard}>
          <Text style={styles.mainLabel}>Total Balance</Text>
          <View style={styles.balanceRow}>
            {balanceLoading ? (
              <Text style={[styles.mainValue, { fontSize: 20, opacity: 0.8 }]}>
                Loading...
              </Text>
            ) : (
              <Text style={styles.mainValue}>
                ₱
                {totals.balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            )}
            <MaterialCommunityIcons
              name={status.icon as any}
              size={42}
              color={status.color}
            />
          </View>
          {balanceLoading ? (
            <ActivityIndicator
              size="small"
              color="#fff"
              style={{ alignSelf: "flex-start", marginBottom: 10 }}
            />
          ) : (
            <Text style={styles.statusFeedback}>{status.msg}</Text>
          )}
          <View style={styles.cardIndicatorRow}>
            <View style={styles.indicator}>
              <MaterialCommunityIcons
                name="arrow-up-circle"
                size={18}
                color="#85CCAB"
              />
              <Text style={styles.indicatorText}>
                {balanceLoading ? "..." : `₱${totals.income.toLocaleString()}`}
              </Text>
            </View>
            <View style={styles.indicator}>
              <MaterialCommunityIcons
                name="arrow-down-circle"
                size={18}
                color="#FFB2B0"
              />
              <Text style={styles.indicatorText}>
                {balanceLoading
                  ? "..."
                  : `₱${totals.expenses.toLocaleString()}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Budget Limits by Category */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Budget Limits</Text>
          <TouchableOpacity onPress={() => router.push("/budget")}>
            <Text style={styles.TxtLinks}>Manage</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.budgetChartCard}>
          {chartLoading ? (
            <ActivityIndicator
              size="small"
              color="#3A6B55"
              style={{ marginVertical: 50 }}
            />
          ) : categoryBudgets.length > 0 ? (
            <>
              <Text style={styles.chartHeaderTitle}>
                Monthly Spent vs. Limit
              </Text>

              {/* Interactivity Tooltip */}
              <View
                style={{
                  height: 30,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selectedPoint ? (
                  <View style={styles.tooltipBadge}>
                    <Text style={styles.tooltipText}>
                      {selectedPoint.label}: ₱
                      {selectedPoint.value.toLocaleString()}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: "#ABBAB3", fontSize: 12 }}>
                    Tap dots to see amounts
                  </Text>
                )}
              </View>

              <LineChart
                data={generateBudgetChartData()}
                width={screenWidth - 60}
                height={220}
                yAxisLabel="₱"
                fromZero
                onDataPointClick={(point) => {
                  // We determine 'isLimit' by looking at the color or the dataset reference
                  // In your chartConfig, Limit is green (index 0) and Spent is coral (index 1)

                  const chartData = generateBudgetChartData();
                  const datasetIndex = chartData.datasets.findIndex(
                    (ds) => ds.data === point.dataset.data
                  );
                  const isLimit = datasetIndex === 0;

                  const categoryName =
                    categoryBudgets[point.index]?.category || "Etc.";

                  setSelectedPoint({
                    value: point.value,
                    label: `${categoryName} (${isLimit ? "Limit" : "Spent"})`,
                  });

                  setTimeout(() => setSelectedPoint(null), 3000);
                }}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1, index) =>
                    index === 1
                      ? `rgba(212, 131, 128, ${opacity})`
                      : `rgba(58, 107, 85, ${opacity})`,
                  labelColor: (opacity = 1) =>
                    `rgba(125, 140, 133, ${opacity})`,
                  propsForDots: { r: "6", strokeWidth: "2", stroke: "#fff" },
                }}
                formatYLabel={(value) =>
                  Number(value) >= 1000
                    ? `${(Number(value) / 1000).toFixed(1)}k`
                    : value
                }
                bezier
                style={{
                  borderRadius: 16,
                  marginVertical: 10,
                  paddingRight: 45,
                }}
              />

              <View style={styles.modernLegendContainer}>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: "#3A6B55" }]}
                  />
                  <Text style={styles.legendText}>Budget Limit</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: "#D48380" }]}
                  />
                  <Text style={styles.legendText}>Total Spent</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Category Breakdown */}
              <View style={styles.categoryDetailsContainer}>
                {categoryBudgets.map((budget) => {
                  const categoryName = budget.category;
                  const monthlyTotal = monthlyCategoryTotals[categoryName] || 0;
                  const budgetLimit = Number(budget.amount) || 0;
                  const percentage =
                    budgetLimit > 0
                      ? Math.min((monthlyTotal / budgetLimit) * 100, 100)
                      : 0;
                  const isOverBudget = monthlyTotal > budgetLimit;

                  return (
                    <View key={budget.id} style={styles.categoryRow}>
                      <View style={styles.categoryInfo}>
                        <View
                          style={[
                            styles.iconBox,
                            {
                              backgroundColor: isOverBudget
                                ? "#FFF1F0"
                                : "#F0F7F4",
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={getCategoryLogo(categoryName) as any}
                            size={18}
                            color={isOverBudget ? "#D48380" : "#3A6B55"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.rowTop}>
                            <Text style={styles.categoryNameText}>
                              {categoryName}
                            </Text>
                            <Text
                              style={[
                                styles.percentageText,
                                {
                                  color: isOverBudget ? "#D48380" : "#3A6B55",
                                },
                              ]}
                            >
                              {Math.round(percentage)}%
                            </Text>
                          </View>
                          <View style={styles.modernProgressContainer}>
                            <View
                              style={[
                                styles.modernProgressBar,
                                {
                                  width: `${percentage}%`,
                                  backgroundColor: isOverBudget
                                    ? "#D48380"
                                    : "#3A6B55",
                                },
                              ]}
                            />
                          </View>
                          <View style={styles.rowBottom}>
                            <Text style={styles.amountLabel}>
                              ₱{monthlyTotal.toLocaleString()}{" "}
                              <Text style={{ color: "#ABBAB3" }}>spent of</Text>{" "}
                              ₱{budgetLimit.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="chart-bar"
                size={50}
                color="#DDE5E1"
              />
              <Text style={styles.emptyTitle}>No Budgets Set</Text>
            </View>
          )}
        </View>

        {/* Recent Added Money Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Added Money</Text>
          <TouchableOpacity onPress={() => router.push("/income")}>
            <Text style={styles.TxtLinks}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {incomeLoading ? (
            <View style={styles.gastosLoaderContainer}>
              <ActivityIndicator size="small" color="#3A6B55" />
              <Text style={styles.loaderText}>Syncing income...</Text>
            </View>
          ) : recentIncome.length > 0 ? (
            <>
              {(showAllIncome ? recentIncome : recentIncome.slice(0, 3)).map(
                (item) => (
                  <View key={item.id} style={styles.transactionItem}>
                    <View
                      style={[
                        styles.iconWrapper,
                        { backgroundColor: "#E8F5E9" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={getIncomeIcon(item.category) as any}
                        size={22}
                        color="#3A6B55"
                      />
                    </View>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemSub}>{item.category}</Text>
                    </View>
                    <Text style={[styles.itemAmount, { color: "#3A6B55" }]}>
                      +₱{Number(item.amount).toLocaleString()}
                    </Text>
                  </View>
                )
              )}

              {recentIncome.length > 3 && (
                <TouchableOpacity
                  style={styles.viewMoreBtn}
                  onPress={() => setShowAllIncome(!showAllIncome)}
                >
                  <Text style={styles.viewMoreTxt}>
                    {showAllIncome ? "Show less" : "View more history"}
                  </Text>
                  <MaterialCommunityIcons
                    name={showAllIncome ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#999"
                  />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recent income recorded</Text>
            </View>
          )}
        </View>

        {/* IMPROVED SPENDING TREND SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>This Week's Gastos</Text>
          <Text style={styles.weekSubtitle}>Mon - Sun</Text>
        </View>

        <View style={styles.trendCard}>
          {chartLoading ? (
            <View style={styles.chartLoaderContainer}>
              <ActivityIndicator size="small" color="#3A6B55" />
              <Text style={styles.loaderText}>Loading trend...</Text>
            </View>
          ) : weeklySpending.some((val) => val > 0) ? (
            <>
              {/* Tooltip for weekly chart */}
              <View style={styles.weeklyTooltipContainer}>
                {selectedWeekPoint ? (
                  <View style={styles.weeklyTooltipBadge}>
                    <Text style={styles.weeklyTooltipText}>
                      {selectedWeekPoint.day}: ₱
                      {selectedWeekPoint.value.toLocaleString()}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.weeklyHintText}>
                    👆 Tap dots to see details
                  </Text>
                )}
              </View>

              <LineChart
                data={{
                  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                  datasets: [{ data: weeklySpending }],
                }}
                width={screenWidth - 60}
                height={200}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#F0F7F4",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(58, 107, 85, ${opacity})`,
                  labelColor: (opacity = 1) =>
                    `rgba(102, 102, 102, ${opacity})`,
                  propsForDots: {
                    r: "5",
                    strokeWidth: "3",
                    stroke: "#3A6B55",
                    fill: "#ffffff",
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: "", // solid lines
                    stroke: "#E5E5E5",
                    strokeWidth: 1,
                  },
                }}
                bezier
                onDataPointClick={(data) => {
                  const dayNames = [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ];
                  setSelectedWeekPoint({
                    value: data.value,
                    day: dayNames[data.index],
                  });
                  setTimeout(() => setSelectedWeekPoint(null), 3000);
                }}
                formatYLabel={(value) =>
                  Number(value) >= 1000
                    ? `${(Number(value) / 1000).toFixed(1)}k`
                    : value
                }
                style={styles.weeklyChart}
              />

              {/* Daily breakdown summary */}
              <View style={styles.weekSummaryContainer}>
                <View style={styles.weekSummaryItem}>
                  <View style={styles.summaryIconBox}>
                    <MaterialCommunityIcons
                      name="calendar-week"
                      size={20}
                      color="#3A6B55"
                    />
                  </View>
                  <Text style={styles.weekSummaryLabel}>Total this week</Text>
                  <Text style={styles.weekSummaryValue}>
                    ₱
                    {weeklySpending
                      .reduce((sum, val) => sum + val, 0)
                      .toLocaleString()}
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.weekSummaryItem}>
                  <View style={styles.summaryIconBox}>
                    <MaterialCommunityIcons
                      name="calendar-today"
                      size={20}
                      color="#D48380"
                    />
                  </View>
                  <Text style={styles.weekSummaryLabel}>Daily average</Text>
                  <Text style={styles.weekSummaryValue}>
                    ₱
                    {Math.round(
                      weeklySpending.reduce((sum, val) => sum + val, 0) / 7
                    ).toLocaleString()}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="chart-line-variant"
                size={40}
                color="#DDE5E1"
              />
              <Text style={styles.emptyText}>Walang gastos this week</Text>
            </View>
          )}
        </View>

        {/* Recent Gastos Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Gastos</Text>
          <TouchableOpacity onPress={() => router.push("/expenses")}>
            <Text style={styles.TxtLinks}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {gastosLoading ? (
            <View style={styles.gastosLoaderContainer}>
              <ActivityIndicator size="small" color="#3A6B55" />
              <Text style={styles.loaderText}>Synching gastos...</Text>
            </View>
          ) : recentTransactions.length > 0 ? (
            <>
              {(showAllGastos
                ? recentTransactions
                : recentTransactions.slice(0, 3)
              ).map((item) => (
                <View key={item.id} style={styles.transactionItem}>
                  <View style={styles.iconWrapper}>
                    <MaterialCommunityIcons
                      name={getCategoryIcon(item.category) as any}
                      size={22}
                      color="#3A6B55"
                    />
                  </View>
                  <View style={styles.itemMeta}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemSub}>{item.category}</Text>
                  </View>
                  <Text style={styles.itemAmount}>
                    -₱{Number(item.amount).toLocaleString()}
                  </Text>
                </View>
              ))}

              {recentTransactions.length > 3 && (
                <TouchableOpacity
                  style={styles.viewMoreBtn}
                  onPress={() => setShowAllGastos(!showAllGastos)}
                >
                  <Text style={styles.viewMoreTxt}>
                    {showAllGastos ? "Show less" : "View more history"}
                  </Text>
                  <MaterialCommunityIcons
                    name={showAllGastos ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#999"
                  />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No available transactions</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const chartConfig = {
  backgroundColor: "#fff",
  backgroundGradientFrom: "#fff",
  backgroundGradientTo: "#fff",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(58, 107, 85, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: "4", strokeWidth: "2", stroke: "#3A6B55" },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EFEBE4", paddingHorizontal: 20 },
  greetingSection: { marginBottom: 20 },
  nameLoaderRow: { flexDirection: "row", alignItems: "center" },
  loadingNameText: {
    marginLeft: 8,
    color: "#888",
    fontSize: 14,
    fontFamily: "Poppins-Regular",
  },
  greetingText: { fontSize: 22, fontFamily: "Poppins-Bold", color: "#333" },
  subtitle: { fontSize: 14, color: "#888", fontFamily: "Poppins-Regular" },
  mainCard: {
    backgroundColor: "#3A6B55",
    borderRadius: 25,
    padding: 25,
    elevation: 8,
  },
  mainLabel: { color: "#fff", opacity: 0.7, fontSize: 14 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
  },
  mainValue: { color: "#fff", fontSize: 32, fontFamily: "Poppins-Bold" },
  statusFeedback: {
    color: "#EFEBE4",
    fontSize: 13,
    fontFamily: "Poppins-Medium",
    fontStyle: "italic",
    opacity: 0.9,
    marginTop: -4,
    marginBottom: 10,
  },
  cardIndicatorRow: {
    flexDirection: "row",
    marginTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 15,
  },
  indicator: { flexDirection: "row", alignItems: "center", marginRight: 20 },
  indicatorText: { color: "#fff", marginLeft: 6, fontSize: 14 },
  budgetChartCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    marginBottom: 10,
  },
  budgetLegend: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
    gap: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Poppins-Regular",
  },
  categoryDetailsContainer: {
    marginTop: 20,
    gap: 15,
  },
  categoryDetail: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  categoryDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  categoryName: {
    fontSize: 14,
    fontFamily: "Poppins-Bold",
    color: "#333",
  },
  categoryPercentage: {
    fontSize: 14,
    fontFamily: "Poppins-Bold",
    color: "#3A6B55",
  },
  categoryAmounts: {
    marginBottom: 8,
  },
  categorySpent: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Poppins-Regular",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#F0F0F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  setBudgetBtn: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#3A6B55",
    borderRadius: 12,
  },
  setBudgetBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Poppins-Medium",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 25,
    marginBottom: 10,
  },
  TxtLinks: {
    fontSize: 14,
    fontFamily: "Poppins-Medium",
    color: "#3A6B55",
    opacity: 0.8,
  },
  sectionTitle: { fontSize: 18, fontFamily: "Poppins-Bold", color: "#333" },
  weekSubtitle: {
    fontSize: 12,
    color: "#999",
    fontFamily: "Poppins-Regular",
  },
  chartWrapper: { minHeight: 180, justifyContent: "center" },
  chartLoaderContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 180,
    backgroundColor: "#fff",
    borderRadius: 16,
  },
  summaryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F0F7F4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryDivider: {
    width: 1,
    height: 60,
    backgroundColor: "#E5E5E5",
    marginHorizontal: 20,
  },
  tooltipBadge: {
    backgroundColor: "#3A6B55",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tooltipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  loaderText: {
    marginTop: 10,
    fontSize: 12,
    color: "#888",
    fontFamily: "Poppins-Regular",
  },
  chart: { borderRadius: 16, marginVertical: 8, paddingRight: 40 },
  chartHeaderTitle: {
    fontSize: 14,
    fontFamily: "Poppins-Medium",
    color: "#888",
    textAlign: "center",
    marginBottom: -10,
  },
  modernLegendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
    gap: 25,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 10,
  },
  categoryRow: {
    marginBottom: 18,
  },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryNameText: {
    fontSize: 14,
    fontFamily: "Poppins-Bold",
    color: "#333",
  },
  percentageText: {
    fontSize: 13,
    fontFamily: "Poppins-Bold",
  },
  modernProgressContainer: {
    height: 6,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    overflow: "hidden",
  },
  modernProgressBar: {
    height: "100%",
    borderRadius: 10,
  },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  amountLabel: {
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    color: "#666",
  },
  overLimitText: {
    fontSize: 10,
    fontFamily: "Poppins-Bold",
    color: "#FF5252",
    textTransform: "uppercase",
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: "#999",
    fontFamily: "Poppins-Regular",
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Poppins-Bold",
    color: "#444",
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#999",
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    marginTop: 5,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  listContainer: { backgroundColor: "#fff", borderRadius: 20, padding: 15 },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EFEBE4",
    justifyContent: "center",
    alignItems: "center",
  },
  gastosLoaderContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  itemMeta: { flex: 1, marginLeft: 15 },
  itemTitle: { fontSize: 15, fontFamily: "Poppins-Bold", color: "#333" },
  itemSub: { fontSize: 12, color: "#999" },
  itemAmount: { fontSize: 15, fontFamily: "Poppins-Bold", color: "#C25450" },
  viewMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 15,
    paddingBottom: 5,
  },
  viewMoreTxt: {
    fontSize: 12,
    color: "#999",
    fontFamily: "Poppins-Medium",
    marginRight: 4,
  },
  // NEW WEEKLY TREND STYLES
  trendCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    marginBottom: 10,
  },
  weeklyTooltipContainer: {
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  weeklyTooltipBadge: {
    backgroundColor: "#3A6B55",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  weeklyTooltipText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Poppins-Medium",
  },
  weeklyHintText: {
    color: "#ABBAB3",
    fontSize: 12,
    fontFamily: "Poppins-Regular",
  },
  weeklyChart: {
    borderRadius: 16,
    marginVertical: 10,
  },
  weekSummaryContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  weekSummaryItem: {
    alignItems: "center",
    gap: 4,
  },
  weekSummaryLabel: {
    fontSize: 11,
    color: "#888",
    fontFamily: "Poppins-Regular",
    marginTop: 2,
  },
  weekSummaryValue: {
    fontSize: 15,
    color: "#333",
    fontFamily: "Poppins-Bold",
    marginTop: 2,
  },
});
