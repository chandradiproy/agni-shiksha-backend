# Graph Report - backend  (2026-04-30)

## Corpus Check
- 91 files · ~34,066 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 298 nodes · 425 edges · 11 communities detected
- Extraction: 56% EXTRACTED · 44% INFERRED · 0% AMBIGUOUS · INFERRED: 185 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `update()` - 39 edges
2. `broadcastCacheInvalidation()` - 22 edges
3. `NotificationCenterService` - 9 edges
4. `generateTokenPair()` - 8 edges
5. `isEmail()` - 7 edges
6. `getTestSeriesMutationBlock()` - 7 edges
7. `NotificationService` - 7 edges
8. `verify()` - 6 edges
9. `generateAndSendOtp()` - 6 edges
10. `updateQuestion()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `update()` --calls--> `verifyRnBiometricRegistration()`  [INFERRED]
  check.ts → src\controllers\biometric.controller.ts
- `update()` --calls--> `setupOnboarding()`  [INFERRED]
  check.ts → src\controllers\student\onboarding.controller.ts
- `update()` --calls--> `completeOnboarding()`  [INFERRED]
  check.ts → src\controllers\student\onboarding.controller.ts
- `update()` --calls--> `handleRazorpayWebhook()`  [INFERRED]
  check.ts → src\controllers\student\premium.controller.ts
- `update()` --calls--> `syncAttemptAnswers()`  [INFERRED]
  check.ts → src\controllers\student\test.controller.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (36): getExamMutationBlock(), getTestSeriesMutationBlock(), isTestSeriesLiveNow(), broadcastCacheInvalidation(), createCoupon(), deleteCoupon(), toggleCouponStatus(), updateCoupon() (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (21): getArticleDetails(), getArticles(), fetchWithVersionedCache(), getAiInsights(), getHomeDashboard(), fetchWithVersionedCache(), getHomeDashboard(), completeOnboarding() (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (12): updateFcmToken(), buildPushData(), normalizeStringArray(), NotificationCenterService, createNotification(), getMyNotifications(), getNotifications(), getUnreadNotificationCount() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (11): deleteAccount(), logout(), updateMe(), update(), updateBadge(), updateQuest(), updateDoubtStatus(), reportContent() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (11): requireAdmin(), getTestAnalysis(), requireAuth(), verifyLogin(), verifyRegistration(), verifyRnBiometricLogin(), verifyRnBiometricRegistration(), CacheService (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.23
Nodes (13): forgotPassword(), generateAccessToken(), generateAndSendOtp(), generateRefreshToken(), generateTokenPair(), googleLogin(), isEmail(), loginWithPassword() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.2
Nodes (5): initializeFirebase(), initializeRedis(), startServer(), createNodeRedisClient(), createUpstashClient()

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (4): Fast2SmsProvider, FirebasePhoneProvider, MockSmsProvider, sendSmsOtp()

### Community 9 - "Community 9"
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

- **Why does `update()` connect `Community 3` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 9`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.288) - this node is a cross-community bridge._
- **Why does `CacheService` connect `Community 4` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `verify()` connect `Community 4` to `Community 5`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 38 inferred relationships involving `update()` (e.g. with `.invalidateTag()` and `adminLogin()`) actually correct?**
  _`update()` has 38 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `broadcastCacheInvalidation()` (e.g. with `triggerNewsSync()` and `updateArticleStatus()`) actually correct?**
  _`broadcastCacheInvalidation()` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._