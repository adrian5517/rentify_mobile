# 🧪 API Testing Guide

## Your Live API
**URL:** `https://new-train-ml.onrender.com`

---

## 📡 Available Endpoints

### 1. **GET /** - Health Check (NEW! ✨)
Check if the API is online and see available endpoints.

**cURL:**
```bash
curl https://new-train-ml.onrender.com/
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "https://new-train-ml.onrender.com/" -Method Get
```

**Expected Response:**
```json
{
  "status": "online",
  "message": "Apartment ML API is running",
  "endpoints": {
    "/predict_knn": "POST - Predict category using KNN",
    "/predict_kmeans": "POST - Predict cluster using KMeans"
  },
  "version": "1.0.0"
}
```

---

### 2. **POST /predict_knn** - Predict with KNN
Predict apartment category using K-Nearest Neighbors.

**Request Body:**
```json
{
  "price": 10000,
  "latitude": 13.6218,
  "longitude": 123.1948
}
```

**cURL:**
```bash
curl -X POST https://new-train-ml.onrender.com/predict_knn \
  -H "Content-Type: application/json" \
  -d "{\"price\": 10000, \"latitude\": 13.6218, \"longitude\": 123.1948}"
```

**PowerShell:**
```powershell
$body = @{
    price = 10000
    latitude = 13.6218
    longitude = 123.1948
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://new-train-ml.onrender.com/predict_knn" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

**Expected Response:**
```json
{
  "category": "Mid Range"
}
```

---

### 3. **POST /predict_kmeans** - Predict with KMeans
Predict apartment cluster using K-Means clustering.

**Request Body:**
```json
{
  "price": 10000,
  "latitude": 13.6218,
  "longitude": 123.1948
}
```

**cURL:**
```bash
curl -X POST https://new-train-ml.onrender.com/predict_kmeans \
  -H "Content-Type: application/json" \
  -d "{\"price\": 10000, \"latitude\": 13.6218, \"longitude\": 123.1948}"
```

**PowerShell:**
```powershell
$body = @{
    price = 10000
    latitude = 13.6218
    longitude = 123.1948
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://new-train-ml.onrender.com/predict_kmeans" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

**Expected Response:**
```json
{
  "cluster_id": 1,
  "cluster_label": "Mid Range"
}
```

---

## 🧪 Quick Test in PowerShell

Run this to test all endpoints:

```powershell
# Test health check
Write-Host "Testing health check..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "https://new-train-ml.onrender.com/" -Method Get

Write-Host "`nTesting KNN prediction..." -ForegroundColor Cyan
$body = @{price=10000; latitude=13.6218; longitude=123.1948} | ConvertTo-Json
Invoke-RestMethod -Uri "https://new-train-ml.onrender.com/predict_knn" -Method Post -ContentType "application/json" -Body $body

Write-Host "`nTesting KMeans prediction..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "https://new-train-ml.onrender.com/predict_kmeans" -Method Post -ContentType "application/json" -Body $body

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
```

---

## 📊 Test Data Examples

### Low Budget Apartment
```json
{
  "price": 5000,
  "latitude": 13.6195,
  "longitude": 123.1965
}
```

### Mid Range Apartment
```json
{
  "price": 10000,
  "latitude": 13.6218,
  "longitude": 123.1948
}
```

### High End Apartment
```json
{
  "price": 20000,
  "latitude": 13.6230,
  "longitude": 123.1920
}
```

---

## 🐛 Error Responses

### Invalid Input
```json
{
  "error": "Invalid input data",
  "details": "could not convert string to float: 'abc'"
}
```

### Missing Fields
```json
{
  "error": "Invalid input data",
  "details": "..."
}
```

---

## ✅ Changes Applied

1. **Added `/` endpoint** - Health check and API info
2. **Updated scikit-learn** - From 1.5.2 to 1.6.1 (matches trained models)
3. **No more version warnings** - Models and library versions now match

---

## 🎯 Next Steps

1. Wait for Render to redeploy (~3 minutes)
2. Test the `/` endpoint to confirm it's working
3. Test the prediction endpoints with real data
4. Integrate into your application!

**Deployment Status:** Render is automatically deploying the latest changes...
