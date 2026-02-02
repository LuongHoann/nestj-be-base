# Audit Log Implementation Notes and Justification

This document explains the rationale behind the approach chosen for integrating `AuditLogService` into the application, specifically addressing the interaction between singleton services and request-scoped contexts in NestJS.

## The Problem: Scope Mismatch between Singleton Service and Request-Scoped Context

When implementing the audit logging feature, the goal was to log user actions (`create`, `update`, `delete`) within the `ItemsService`. The `AuditLogService` requires information about the `User` performing the action. This user information is available in the `RequestContext` (managed by `RequestContextInterceptor`) and is `Scope.REQUEST`, meaning a new instance is created for each incoming HTTP request.

`ItemsService`, by default, is a **singleton** in NestJS. This means only one instance of `ItemsService` is created and reused throughout the application's lifecycle.

A fundamental rule in NestJS dependency injection is that a **singleton service cannot reliably inject a request-scoped provider.** If `ItemsService` were to directly inject `RequestContext`, NestJS would resolve `RequestContext` only once when `ItemsService` is first instantiated (e.g., at application startup). At that time, there is no active HTTP request, so the `RequestContext` would be empty or contain stale data. All subsequent requests processed by this singleton `ItemsService` would then operate with the same, incorrect `RequestContext` instance, leading to inaccurate audit logs (e.g., logging the wrong user or no user at all).

## Why Passing UserContext from the Controller is the Solution

The `ItemsController` (like all controllers) is inherently **request-scoped**. This means for every incoming HTTP request, a new instance of the controller (or at least its methods) is invoked, and it has direct access to the context of *that specific request*.

The solution implemented involves:

1.  **Extracting `UserContext` in the Controller:** The `@CurrentUser()` decorator is used in the `ItemsController`'s `create`, `update`, and `delete` methods to reliably extract the `UserContext` (which correctly originates from `request.user` populated by `JwtStrategy` and `RequestContextInterceptor`) for the current request.

2.  **Passing `UserContext` as a Method Argument to the Service:** The extracted `UserContext` is then explicitly passed as an argument to the corresponding `ItemsService` methods (`itemsService.create(user, collection, data)`).

This approach ensures:

*   **Scope Safety:** The singleton `ItemsService` does not directly inject a request-scoped `RequestContext`. Instead, it receives the *already resolved and request-specific* `UserContext` as a method parameter. This completely avoids the scope mismatch problem.
*   **Explicitness:** The method signatures of `ItemsService` (`async create(user: UserContext, collection: string, data: any)`) clearly indicate that these operations depend on user context. This improves code readability and maintainability.
*   **Testability:** `ItemsService` methods become easier to unit test, as `UserContext` can be directly mocked and passed as an argument, without needing to simulate the entire NestJS request lifecycle.
*   **Handling Anonymous/Public Actions:** If an endpoint does not require authentication (e.g., if `JwtAuthGuard` is not applied or the user is not logged in), the `@CurrentUser()` decorator will provide `null` (or an object indicating no user). This `null` can then be passed to the `AuditLogService`, allowing it to correctly log actions by anonymous users or simply ignore logging if no user is present.
*   **Preserving Singleton Benefits:** `ItemsService` remains a singleton, benefiting from better performance and resource utilization by avoiding re-instantiation for every request.

## Alternatives Considered (and why they were not chosen)

*   **Making `ItemsService` Request-Scoped:** While this would resolve the scope mismatch, it would mean `ItemsService` (and potentially other services that depend on it) would be instantiated for every request, which can have performance implications. It also complicates the overall service architecture by introducing more request-scoped components than necessary.
*   **Using `ModuleRef` to Dynamically Resolve `RequestContext`:** NestJS provides `ModuleRef` which can be used within a singleton service to dynamically resolve request-scoped providers. However, this adds more boilerplate code and complexity (`this.moduleRef.resolve(RequestContext, { strict: false })`) compared to the straightforward method parameter passing. For this specific use case, direct parameter passing is cleaner.

In conclusion, while `JwtStrategy` and `RequestContextInterceptor` correctly prepare the user context, the most robust and idiomatic way for a singleton service to access this request-specific information is to have it explicitly passed down from a request-scoped component like a controller.
