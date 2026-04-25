import catboost
model = catboost.CatBoostRegressor()
model.load_model("backend/models/hybrid_graphsage_catboost_best.cbm")
print("Hybrid feature names:")
for i, f in enumerate(model.feature_names_):
    print(f"  [{i}] {f}")
