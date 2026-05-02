# Graph Report - backend  (2026-05-02)

## Corpus Check
- 93 files · ~35,235 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 305 nodes · 432 edges · 11 communities detected
- Extraction: 57% EXTRACTED · 43% INFERRED · 0% AMBIGUOUS · INFERRED: 187 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `update()` - 40 edges
2. `broadcastCacheInvalidation()` - 22 edges
3. `generateTokenPair()` - 9 edges
4. `NotificationCenterService` - 9 edges
5. `NotificationService` - 8 edges
6. `isEmail()` - 7 edges
7. `getTestSeriesMutationBlock()` - 7 edges
8. `verify()` - 6 edges
9. `generateAndSendOtp()` - 6 edges
10. `updateQuestion()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `update()` --calls--> `setupOnboarding()`  [INFERRED]
  check.ts → src\controllers\student\onboarding.controller.ts
- `update()` --calls--> `completeOnboarding()`  [INFERRED]
  check.ts → src\controllers\student\onboarding.controller.ts
- `update()` --calls--> `handleRazorpayWebhook()`  [INFERRED]
  check.ts → src\controllers\student\premium.controller.ts
- `update()` --calls--> `syncAttemptAnswers()`  [INFERRED]
  check.ts → src\controllers\student\test.controller.ts
- `update()` --calls--> `updateNote()`  [INFERRED]
  check.ts → src\controllers\student\utility.controller.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (35): getExamMutationBlock(), getTestSeriesMutationBlock(), isTestSeriesLiveNow(), broadcastCacheInvalidation(), createCoupon(), deleteCoupon(), toggleCouponStatus(), updateCoupon() (+27 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (14): deleteAccount(), logout(), updateMe(), verifyLogin(), verifyRegistration(), verifyRnBiometricRegistration(), update(), updateBadge() (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (21): requireAdmin(), getTestAnalysis(), forgotPassword(), generateAccessToken(), generateAndSendOtp(), generateRefreshToken(), generateTokenPair(), googleLogin() (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (12): updateFcmToken(), buildPushData(), normalizeStringArray(), NotificationCenterService, createNotification(), getMyNotifications(), getNotifications(), getUnreadNotificationCount() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (19): CacheService, getArticleDetails(), getArticles(), fetchWithVersionedCache(), getAiInsights(), getHomeDashboard(), fetchWithVersionedCache(), getHomeDashboard() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (5): initializeFirebase(), initializeRedis(), startServer(), createNodeRedisClient(), createUpstashClient()

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (4): Fast2SmsProvider, FirebasePhoneProvider, MockSmsProvider, sendSmsOtp()

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (3): getBookmarks(), toggleBookmark(), updateNote()

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (4): adminLogin(), generateAdminToken(), requestAdminOtp(), sendEmailOTP()

### Community 10 - "Community 10"
Cohesion: 0.33
Nodes (4): createCategory(), deleteCategory(), getAllCategories(), updateCategory()

### Community 11 - "Community 11"
Cohesion: 0.47
Nodes (5): calculateDiscountedPrice(), createOrder(), getActivePlans(), handleRazorpayWebhook(), validateCoupon()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `update()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 7`, `Community 8`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.288) - this node is a cross-community bridge._
- **Why does `CacheService` connect `Community 4` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 39 inferred relationships involving `update()` (e.g. with `.invalidateTag()` and `adminLogin()`) actually correct?**
  _`update()` has 39 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `broadcastCacheInvalidation()` (e.g. with `triggerNewsSync()` and `updateArticleStatus()`) actually correct?**
  _`broadcastCacheInvalidation()` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._