import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
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
type FilterType = "All" | "Today";

export default function ExpensesScreen() {
  const router = useRouter();

  // --- States ---
  const [filterLoading, setFilterLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [transactionLoading, setTransactionLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [rawExpenses, setRawExpenses] = useState<any[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");

  const categories = ["Food", "Transport", "Bills", "Shopping", "Etc."];

  // --- Date Helper (Strict Monthly) ---
  const getStartOfMonth = () => {
    const now = new Date();
    // Returns the first day of the current month at 00:00:00
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  // --- Computed Derived State ---
  const overallExpenseTotal = (rawExpenses || []).reduce(
    (s, i) => s + Number(i.amount),
    0
  );
  const overallBalance = totalIncome - overallExpenseTotal;
  const spentPercentage =
    totalIncome > 0 ? overallExpenseTotal / totalIncome : 0;
  const transactionCount = rawExpenses.length;

  // --- Real-time Fetching Logic ---
  useEffect(() => {
    const subscription = supabase
      .channel("expenses_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => {
          fetchExpensesData(false);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchExpensesData(true);
    }, [])
  );

  useEffect(() => {
    applyFilter();
  }, [activeFilter, rawExpenses]);

  // --- Actions ---
  async function fetchExpensesData(staggered = true) {
    if (staggered) {
      setFilterLoading(true);
      setBalanceLoading(true);
      setChartLoading(true);
      setTransactionLoading(true);
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.replace("/(auth)/login");

      const [expRes, incRes, budRes] = await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", session.user.id)
          .order("date", { ascending: false }),
        supabase.from("income").select("amount").eq("user_id", session.user.id),
        // Filter ONLY Monthly period budgets
        supabase
          .from("budgets")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("period", "monthly"),
      ]);

      setRawExpenses(expRes.data || []);
      setBudgets(budRes.data || []);
      setTotalIncome(
        incRes.data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0
      );

      if (staggered) {
        setTimeout(() => setFilterLoading(false), 400);
        setTimeout(() => setBalanceLoading(false), 700);
        setTimeout(() => setChartLoading(false), 1000);
        setTimeout(() => setTransactionLoading(false), 1300);
      } else {
        setFilterLoading(false);
        setBalanceLoading(false);
        setChartLoading(false);
        setTransactionLoading(false);
      }
    } catch (error: any) {
      console.error(error);
      showMessage({ message: error.message, type: "danger" });
    } finally {
      setRefreshing(false);
    }
  }

  const applyFilter = () => {
    const now = new Date();
    let filtered = (rawExpenses || []).filter((item) => {
      const itemDate = new Date(item.date);
      return activeFilter === "Today"
        ? itemDate.toDateString() === now.toDateString()
        : true;
    });
    setFilteredExpenses(filtered);
    setTotalSpent(filtered.reduce((sum, item) => sum + Number(item.amount), 0));
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchExpensesData(true);
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Confirm Delete", "Sigurado ka ba?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("expenses")
            .delete()
            .eq("id", id);
          if (error)
            showMessage({ message: "Failed to delete.", type: "danger" });
          else {
            showMessage({ message: "Deleted successfully", type: "success" });
            setRawExpenses((prev) => prev.filter((e) => e.id !== id));
          }
        },
      },
    ]);
  };

  // --- Budget Analysis Helpers ---
  const getCategorySpentThisMonth = (cat: string) => {
    const startOfMonth = getStartOfMonth();
    return rawExpenses
      .filter((e) => {
        const expenseDate = new Date(e.date);
        return e.category === cat && expenseDate >= startOfMonth;
      })
      .reduce((s, i) => s + Number(i.amount), 0);
  };

  const getCategoryLimit = (cat: string) => {
    const budget = budgets.find(
      (b) => b.category.toLowerCase() === cat.toLowerCase()
    );
    return budget ? Number(budget.amount) : null;
  };

  const handleAddExpense = async () => {
    const numericInputAmount = parseFloat(amount);
    if (!title || !amount || isNaN(numericInputAmount)) {
      return showMessage({
        message: "Please fill all fields",
        type: "warning",
      });
    }

    // 1. Identify limit and current spent for this specific category this month
    const limit = getCategoryLimit(category);
    const spentThisMonth = getCategorySpentThisMonth(category);

    // 2. Budget Limit Validation (Pop-up notification)
    if (limit !== null && spentThisMonth + numericInputAmount > limit) {
      return Alert.alert(
        "Monthly Limit Reached!",
        `Sobra na ang expense na ito sa iyong monthly budget para sa ${category}.\n\nLimit: ₱${limit.toLocaleString()}\nNa-spend na: ₱${spentThisMonth.toLocaleString()}\nKulang: ₱${(
          limit - spentThisMonth
        ).toLocaleString()}`,
        [
          { text: "I-cancel", style: "cancel" },
          {
            text: "Go Anyway",
            style: "default",
            onPress: () => processSaveExpense(numericInputAmount),
          },
        ]
      );
    }

    // 3. Balance Validation
    if (numericInputAmount > overallBalance) {
      return showMessage({
        message: `Kulang ang balance! ₱${overallBalance.toLocaleString()}`,
        type: "danger",
        backgroundColor: "#C25450",
      });
    }

    processSaveExpense(numericInputAmount);
  };

  const processSaveExpense = async (finalAmount: number) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("expenses")
        .insert([
          {
            user_id: user.id,
            title,
            amount: finalAmount,
            category,
            date: new Date().toISOString(),
          },
        ]);
      if (error) throw error;
      setAddModalVisible(false);
      setTitle("");
      setAmount("");
      showMessage({
        message: "Expense added! 💸",
        type: "success",
        backgroundColor: "#3A6B55",
      });
    } catch (error: any) {
      showMessage({ message: error.message, type: "danger" });
    }
  };

  const pieData = categories.map((cat) => ({
    name: cat,
    amount: getCategorySpentThisMonth(cat),
    color: getCategoryColor(cat),
    legendFontColor: "#7F7F7F",
    legendFontSize: 12,
  }));

  const getGroupedData = () => {
    if (transactionLoading) return [];
    const now = new Date().toDateString();
    const today = filteredExpenses.filter(
      (e) => new Date(e.date).toDateString() === now
    );
    const others = filteredExpenses.filter(
      (e) => new Date(e.date).toDateString() !== now
    );
    const items: any[] = [];
    if (today.length > 0)
      items.push({ type: "header", title: "Today" }, ...today);
    if (others.length > 0)
      items.push({ type: "header", title: "History" }, ...others);
    return items;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.filterWrapper}>
          {filterLoading ? (
            <ActivityIndicator size="small" color="#3A6B55" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(["All", "Today"] as FilterType[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setActiveFilter(f)}
                  style={[
                    styles.filterChip,
                    activeFilter === f && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      activeFilter === f && styles.filterTextActive,
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <FlatList
          data={getGroupedData()}
          keyExtractor={(item, index) => item.id || `header-${index}`}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            !transactionLoading ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="wallet-giftcard"
                  size={50}
                  color="#ccc"
                />
                <Text style={styles.emptyText}>No transactions found.</Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleManualRefresh}
              tintColor="#3A6B55"
            />
          }
          renderItem={({ item }) => {
            if (item.type === "header")
              return <Text style={styles.groupHeader}>{item.title}</Text>;
            return (
              <Swipeable
                renderRightActions={() => (
                  <TouchableOpacity
                    style={styles.deleteAction}
                    onPress={() => handleDelete(item.id)}
                  >
                    <MaterialCommunityIcons
                      name="delete"
                      size={24}
                      color="#fff"
                    />
                  </TouchableOpacity>
                )}
                overshootRight={false}
              >
                <View style={styles.expenseItem}>
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: getCategoryColor(item.category) },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={getCategoryIcon(item.category) as any}
                      size={22}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemCategory}>{item.category}</Text>
                  </View>
                  <View style={styles.amountContainer}>
                    <Text style={styles.amountText}>
                      - ₱{Number(item.amount).toLocaleString()}
                    </Text>
                    <Text style={styles.dateText}>
                      {new Date(item.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                </View>
              </Swipeable>
            );
          }}
          ListHeaderComponent={
            <>
              <View
                style={[
                  styles.totalCard,
                  balanceLoading && { justifyContent: "center" },
                ]}
              >
                {balanceLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.totalLabel}>
                        Total Spent ({activeFilter})
                      </Text>
                      <Text style={styles.totalAmount}>
                        ₱{totalSpent.toLocaleString()}
                      </Text>
                      <View style={styles.progressContainer}>
                        <View
                          style={[
                            styles.progressBar,
                            {
                              width: `${Math.min(spentPercentage * 100, 100)}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.balanceSub}>
                        Overall Balance: ₱{overallBalance.toLocaleString()}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="wallet-outline"
                      size={40}
                      color="rgba(255,255,255,0.4)"
                    />
                  </>
                )}
              </View>

              {!balanceLoading && (
                <View style={styles.insightRow}>
                  <View style={styles.insightCard}>
                    <MaterialCommunityIcons
                      name="chart-line"
                      size={16}
                      color="#3A6B55"
                    />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.insightLabel}>History</Text>
                      <Text style={styles.insightValue}>
                        {transactionCount} items
                      </Text>
                    </View>
                  </View>
                  <View style={styles.insightCard}>
                    <MaterialCommunityIcons
                      name="trending-down"
                      size={16}
                      color="#C25450"
                    />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.insightLabel}>Usage</Text>
                      <Text style={styles.insightValue}>
                        {(spentPercentage * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.chartWrapper}>
                <Text style={styles.chartHeader}>Monthly Category Limits</Text>
                {chartLoading ? (
                  <ActivityIndicator color="#3A6B55" />
                ) : (
                  <View style={styles.chartRow}>
                    <PieChart
                      data={
                        totalSpent > 0
                          ? pieData
                          : [{ name: "N/A", amount: 1, color: "#eee" }]
                      }
                      width={screenWidth * 0.4}
                      height={100}
                      accessor={"amount"}
                      backgroundColor={"transparent"}
                      paddingLeft={"15"}
                      hasLegend={false}
                      chartConfig={{
                        color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
                      }}
                    />
                    <View style={styles.chartRight}>
                      {categories.map((cat) => {
                        const spent = getCategorySpentThisMonth(cat);
                        const limit = getCategoryLimit(cat);
                        const isOver = limit !== null && spent > limit;
                        return (
                          <View key={cat} style={styles.legendItem}>
                            <View
                              style={[
                                styles.colorDot,
                                { backgroundColor: getCategoryColor(cat) },
                              ]}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.legendName}>{cat}</Text>
                              {limit !== null ? (
                                <Text
                                  style={[
                                    styles.budgetLabel,
                                    isOver && styles.overBudgetText,
                                  ]}
                                >
                                  ₱{spent.toLocaleString()} / ₱
                                  {limit.toLocaleString()}
                                </Text>
                              ) : (
                                <Text style={styles.budgetLabel}>No Limit</Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Transactions</Text>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setAddModalVisible(true)}
                >
                  <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
              {transactionLoading && (
                <ActivityIndicator color="#3A6B55" style={{ marginTop: 20 }} />
              )}
            </>
          }
        />

        <Modal visible={addModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Add Expense</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Title"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={styles.input}
                placeholder="Amount"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <View style={styles.categoryPicker}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.catChip,
                      category === cat && {
                        backgroundColor: getCategoryColor(cat),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        category === cat && { color: "#fff" },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setAddModalVisible(false)}
                >
                  <Text>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleAddExpense}
                >
                  <Text style={{ color: "#fff" }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <FlashMessage position="top" />
      </View>
    </GestureHandlerRootView>
  );
}

// --- Icons & Colors ---
const getCategoryIcon = (cat: string) => {
  const c = cat.toLowerCase();
  if (c.includes("food")) return "food-apple";
  if (c.includes("trans")) return "bus-side";
  if (c.includes("bill")) return "lightning-bolt";
  if (c.includes("shop")) return "cart";
  return "dots-horizontal";
};

const getCategoryColor = (cat: string) => {
  const c = cat.toLowerCase();
  if (c.includes("food")) return "#F2994A";
  if (c.includes("trans")) return "#56CCF2";
  if (c.includes("bill")) return "#EB5757";
  if (c.includes("shop")) return "#9B51E0";
  return "#3A6B55";
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EFEBE4",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  filterWrapper: { marginBottom: 15, height: 40, justifyContent: "center" },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  filterChipActive: { backgroundColor: "#3A6B55", borderColor: "#3A6B55" },
  filterText: { fontSize: 13, color: "#666", fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  totalCard: {
    backgroundColor: "#C25450",
    padding: 22,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    minHeight: 110,
  },
  totalLabel: { color: "#fff", opacity: 0.8, fontSize: 12 },
  totalAmount: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  progressContainer: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    marginVertical: 8,
  },
  progressBar: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  balanceSub: { color: "#fff", fontSize: 12, fontWeight: "600" },
  insightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  insightCard: {
    backgroundColor: "#fff",
    width: "48%",
    padding: 12,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  insightLabel: { fontSize: 10, color: "#999", textTransform: "uppercase" },
  insightValue: { fontSize: 14, fontWeight: "bold", color: "#333" },
  chartWrapper: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    minHeight: 160,
  },
  chartHeader: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#888",
    marginBottom: 10,
  },
  chartRow: { flexDirection: "row", alignItems: "center" },
  chartRight: { flex: 1, paddingLeft: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  colorDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendName: { fontSize: 12, fontWeight: "bold", color: "#333" },
  budgetLabel: { fontSize: 10, color: "#888" },
  overBudgetText: { color: "#C25450", fontWeight: "bold" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  addBtn: {
    backgroundColor: "#3A6B55",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#aaa",
    marginTop: 15,
    marginBottom: 8,
  },
  expenseItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  amountContainer: { alignItems: "flex-end", justifyContent: "center" },
  dateText: { fontSize: 10, color: "#999", marginTop: 2 },
  itemDetails: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 15, fontWeight: "bold" },
  itemCategory: { fontSize: 11, color: "#999" },
  amountText: { fontSize: 15, fontWeight: "bold", color: "#C25450" },
  deleteAction: {
    backgroundColor: "#C25450",
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    borderRadius: 18,
    marginBottom: 10,
  },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "#999", marginTop: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    minHeight: 400,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  input: {
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  categoryPicker: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  catChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#eee",
    marginRight: 8,
    marginBottom: 8,
  },
  catChipText: { fontSize: 13, color: "#666" },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cancelBtn: { flex: 1, padding: 15, alignItems: "center" },
  saveBtn: {
    flex: 2,
    backgroundColor: "#3A6B55",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
  },
});
