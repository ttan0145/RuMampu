from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .import_service import confirm_income_import, preview_income_import
from .models import (
    CommitmentItem,
    ExpenseCategory,
    ExpenseEntry,
    IncomeImportBatch,
    IncomeEntry,
    IncomeSource,
    WorkCostEntry,
    WorkCostItem,
)
from .serializers import (
    ApiErrorSerializer,
    CommitmentItemSerializer,
    CommitmentItemUpdateSerializer,
    ExpenseCategoryCreateSerializer,
    ExpenseCategorySerializer,
    ExpenseEntryCreateSerializer,
    ExpenseEntrySerializer,
    IncomeEntryCreateSerializer,
    IncomeEntrySerializer,
    IncomeEntryUpdateSerializer,
    IncomeImportBatchSerializer,
    IncomeImportUploadSerializer,
    IncomeRecordSerializer,
    IncomeSourceCreateSerializer,
    IncomeSourceSerializer,
    WorkCostItemCreateSerializer,
    WorkCostItemSerializer,
    WorkCostEntrySerializer,
    WorkCostEntryWriteSerializer,
    WorkCostMonthSummarySerializer,
    WorkCostMonthQuerySerializer,
)
from .analysis_service import build_work_cost_month_summary
from .services import create_income_entry, is_unusually_high, profile_for_request, update_income_entry
from django.utils import timezone


# EN: Aggregate the profile-owned US1.1/US1.2 income record for the client.
# 中文：为客户端汇总当前 profile 所有的 US1.1/US1.2 收入记录。
class IncomeRecordView(APIView):

    @extend_schema(
        operation_id="income_record_retrieve",
        summary="Get the current guest's income record",
        tags=["Income"],
        responses={200: IncomeRecordSerializer},
    )
    def get(self, request):
        profile = profile_for_request(request)
        return Response(
            {
                "profile_id": str(profile.public_id),
                "recorded_month_count": profile.financial_periods.count(),
                "sources": IncomeSourceSerializer(
                    profile.income_sources.filter(is_active=True), many=True
                ).data,
                "entries": IncomeEntrySerializer(profile.income_entries.all(), many=True).data,
            }
        )


# EN: List predefined sources and create profile-owned custom sources (AC1.1.3-1.1.5).
# 中文：列出预设来源并创建 profile 自定义来源（AC1.1.3-1.1.5）。
class IncomeSourceListCreateView(APIView):

    @extend_schema(
        operation_id="income_sources_list",
        summary="List active income sources",
        tags=["Income"],
        responses={200: IncomeSourceSerializer(many=True)},
    )
    def get(self, request):
        profile = profile_for_request(request)
        sources = profile.income_sources.filter(is_active=True)
        return Response(IncomeSourceSerializer(sources, many=True).data)

    @extend_schema(
        operation_id="income_sources_create",
        summary="Create a custom income source",
        tags=["Income"],
        request=IncomeSourceCreateSerializer,
        responses={
            201: IncomeSourceSerializer,
            400: ApiErrorSerializer,
        },
    )
    def post(self, request):
        profile = profile_for_request(request)
        serializer = IncomeSourceCreateSerializer(
            data=request.data,
            context={"profile": profile},
        )
        serializer.is_valid(raise_exception=True)
        source = IncomeSource.objects.create(
            profile=profile,
            name=serializer.validated_data["name"],
            is_custom=True,
        )
        return Response(IncomeSourceSerializer(source).data, status=status.HTTP_201_CREATED)


# EN: US1.1 lists existing entries and creates validated/confirmed income.
# 中文：US1.1 列出现有记录，并创建经过校验和确认的收入。
class IncomeEntryListCreateView(APIView):

    @extend_schema(
        operation_id="income_entries_list",
        summary="List income entries",
        tags=["Income"],
        responses={200: IncomeEntrySerializer(many=True)},
    )
    def get(self, request):
        profile = profile_for_request(request)
        return Response(IncomeEntrySerializer(profile.income_entries.all(), many=True).data)

    @extend_schema(
        operation_id="income_entries_create",
        summary="Create an income entry",
        description=(
            "Amounts are decimal strings. A manual amount that is unusually high after at least "
            "three comparable entries returns 409 until confirm_outlier is true."
        ),
        tags=["Income"],
        request=IncomeEntryCreateSerializer,
        responses={
            201: IncomeEntrySerializer,
            400: ApiErrorSerializer,
            409: OpenApiResponse(
                response=ApiErrorSerializer,
                description="Explicit confirmation is required for an unusual amount.",
            ),
        },
    )
    def post(self, request):
        profile = profile_for_request(request)
        serializer = IncomeEntryCreateSerializer(
            data=request.data,
            context={"profile": profile},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        warning, baseline = (False, None)
        if data["entry_method"] == "manual":
            warning, baseline = is_unusually_high(profile, data["amount"])
        if warning and not data["confirm_outlier"]:
            return Response(
                {
                    "error": {
                        "code": "income_outlier_confirmation_required",
                        "message": (
                            "This amount is well above the profile's usual entries. "
                            "Confirm to keep it."
                        ),
                        "context": {"median_amount": str(baseline)},
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        source = None
        if data.get("source_id") is not None:
            source = profile.income_sources.get(id=data["source_id"], is_active=True)
        entry = create_income_entry(
            profile=profile,
            source=source,
            income_date=data["date"],
            gross_amount=data["amount"],
            entry_method=data["entry_method"],
        )
        return Response(IncomeEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class HistoricalIncomeEntryDetailView(APIView):
    @extend_schema(
        operation_id="income_entry_update",
        summary="Update a manual or historical monthly income entry",
        tags=["Income"],
        request=IncomeEntryUpdateSerializer,
        responses={200: IncomeEntrySerializer, 400: ApiErrorSerializer, 404: ApiErrorSerializer},
    )
    def patch(self, request, entry_id: int):
        from rest_framework.exceptions import NotFound

        profile = profile_for_request(request)
        entry = profile.income_entries.filter(id=entry_id).first()
        if entry is None:
            raise NotFound("Income entry was not found for this profile.")

        serializer = IncomeEntryUpdateSerializer(
            data=request.data,
            context={"profile": profile, "entry": entry},
        )
        serializer.is_valid(raise_exception=True)
        source = None
        source_id = serializer.validated_data.get("source_id")
        if source_id is not None:
            source = profile.income_sources.get(id=source_id, is_active=True)
        updated = update_income_entry(
            entry=entry,
            income_date=serializer.validated_data["date"],
            gross_amount=serializer.validated_data["amount"],
            source=source,
        )
        return Response(IncomeEntrySerializer(updated).data)


# EN: List and extend categories for separate, dated US1.3 work-cost entries.
# 中文：列出并扩展 US1.3 独立带日期工作成本记录使用的类别。
class WorkCostItemListCreateView(APIView):

    @extend_schema(
        operation_id="work_cost_items_list",
        summary="List active work-cost categories",
        tags=["Work costs"],
        responses={200: WorkCostItemSerializer(many=True)},
    )
    def get(self, request):
        profile = profile_for_request(request)
        items = profile.work_cost_items.filter(is_active=True)
        return Response(WorkCostItemSerializer(items, many=True).data)

    @extend_schema(
        operation_id="work_cost_items_create",
        summary="Create a custom work-cost category",
        tags=["Work costs"],
        request=WorkCostItemCreateSerializer,
        responses={201: WorkCostItemSerializer, 400: ApiErrorSerializer},
    )
    def post(self, request):
        profile = profile_for_request(request)
        serializer = WorkCostItemCreateSerializer(
            data=request.data,
            context={"profile": profile},
        )
        serializer.is_valid(raise_exception=True)
        item = WorkCostItem.objects.create(
            profile=profile,
            name=serializer.validated_data["name"],
            is_custom=True,
        )
        return Response(WorkCostItemSerializer(item).data, status=status.HTTP_201_CREATED)


# EN: List and create the dated facts used by US1.3 monthly calculations.
# 中文：列出和创建 US1.3 按月计算使用的带日期事实记录。
class WorkCostEntryListCreateView(APIView):

    @extend_schema(
        operation_id="work_cost_entries_list",
        summary="List recorded work-cost entries",
        tags=["Work costs"],
        responses={200: WorkCostEntrySerializer(many=True)},
    )
    def get(self, request):
        profile = profile_for_request(request)
        entries = profile.work_cost_entries.select_related("category")
        return Response(WorkCostEntrySerializer(entries, many=True).data)

    @extend_schema(
        operation_id="work_cost_entries_create",
        summary="Create a dated work-cost entry",
        tags=["Work costs"],
        request=WorkCostEntryWriteSerializer,
        responses={201: WorkCostEntrySerializer, 400: ApiErrorSerializer},
    )
    def post(self, request):
        profile = profile_for_request(request)
        serializer = WorkCostEntryWriteSerializer(data=request.data, context={"profile": profile})
        serializer.is_valid(raise_exception=True)
        entry = WorkCostEntry.objects.create(
            profile=profile,
            category=profile.work_cost_items.get(id=serializer.validated_data["category_id"]),
            amount=serializer.validated_data["amount"],
            cost_date=serializer.validated_data["date"],
        )
        return Response(WorkCostEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class WorkCostEntryDetailView(APIView):
    @extend_schema(
        operation_id="work_cost_entries_update",
        summary="Update one dated work-cost entry",
        tags=["Work costs"],
        request=WorkCostEntryWriteSerializer,
        responses={200: WorkCostEntrySerializer, 400: ApiErrorSerializer, 404: ApiErrorSerializer},
    )
    def patch(self, request, entry_id: int):
        profile = profile_for_request(request)
        entry = profile.work_cost_entries.filter(id=entry_id).select_related("category").first()
        if entry is None:
            from rest_framework.exceptions import NotFound

            raise NotFound("Work-cost entry was not found for this profile.")
        serializer = WorkCostEntryWriteSerializer(
            data=request.data,
            partial=True,
            context={"profile": profile},
        )
        serializer.is_valid(raise_exception=True)
        if "category_id" in serializer.validated_data:
            entry.category = profile.work_cost_items.get(id=serializer.validated_data["category_id"])
        if "amount" in serializer.validated_data:
            entry.amount = serializer.validated_data["amount"]
        if "date" in serializer.validated_data:
            entry.cost_date = serializer.validated_data["date"]
        entry.save()
        return Response(WorkCostEntrySerializer(entry).data)


class WorkCostMonthSummaryView(APIView):
    @extend_schema(
        operation_id="work_cost_month_summary",
        summary="Calculate income after work costs for one recorded month",
        tags=["Work costs"],
        parameters=[WorkCostMonthQuerySerializer],
        responses={200: WorkCostMonthSummarySerializer, 400: ApiErrorSerializer},
    )
    def get(self, request):
        query = WorkCostMonthQuerySerializer(data=request.query_params.dict())
        query.is_valid(raise_exception=True)
        month_text = query.validated_data.get("month", timezone.localdate().strftime("%Y-%m"))
        year, month_number = map(int, month_text.split("-"))
        profile = profile_for_request(request)
        payload = build_work_cost_month_summary(profile, year=year, month=month_number)
        month_values = {
            value.strftime("%Y-%m")
            for value in profile.income_entries.values_list("income_date", flat=True)
        } | {
            value.strftime("%Y-%m")
            for value in profile.work_cost_entries.values_list("cost_date", flat=True)
        }
        month_values.add(timezone.localdate().strftime("%Y-%m"))
        payload["available_months"] = sorted(month_values, reverse=True)
        return Response(WorkCostMonthSummarySerializer(payload).data)


# EN: Return the separated living, debt, and savings groups for US1.4.
# 中文：返回 US1.4 分开的生活、债务与储蓄分组。
class CommitmentItemListView(APIView):

    @extend_schema(
        operation_id="commitment_items_list",
        summary="List active monthly financial commitments",
        tags=["Commitments"],
        responses={200: CommitmentItemSerializer(many=True)},
    )
    def get(self, request):
        profile = profile_for_request(request)
        items = profile.commitment_items.filter(is_active=True)
        return Response(CommitmentItemSerializer(items, many=True).data)


# EN: Persist one profile-owned US1.4 commitment amount.
# 中文：持久化一项归当前 profile 所有的 US1.4 承诺金额。
class CommitmentItemDetailView(APIView):

    @extend_schema(
        operation_id="commitment_items_update",
        summary="Update a monthly financial commitment amount",
        tags=["Commitments"],
        request=CommitmentItemUpdateSerializer,
        responses={
            200: CommitmentItemSerializer,
            400: ApiErrorSerializer,
            404: ApiErrorSerializer,
        },
    )
    def patch(self, request, item_id: int):
        profile = profile_for_request(request)
        item = profile.commitment_items.filter(id=item_id, is_active=True).first()
        if item is None:
            from rest_framework.exceptions import NotFound

            raise NotFound("Commitment item was not found for this profile.")
        serializer = CommitmentItemUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item.monthly_amount = serializer.validated_data["monthly_amount"]
        item.save(update_fields=["monthly_amount", "updated_at"])
        return Response(CommitmentItemSerializer(item).data)


# EN: Serve predefined and custom categories used by US1.5 and US1.7.
# 中文：提供 US1.5 与 US1.7 使用的预设和自定义支出类别。
class ExpenseCategoryListCreateView(APIView):

    @extend_schema(
        operation_id="expense_categories_list",
        summary="List active expense categories",
        tags=["Expenses"],
        responses={200: ExpenseCategorySerializer(many=True)},
    )
    def get(self, request):
        profile = profile_for_request(request)
        categories = profile.expense_categories.filter(is_active=True)
        return Response(ExpenseCategorySerializer(categories, many=True).data)

    @extend_schema(
        operation_id="expense_categories_create",
        summary="Create a custom expense category",
        tags=["Expenses"],
        request=ExpenseCategoryCreateSerializer,
        responses={201: ExpenseCategorySerializer, 400: ApiErrorSerializer},
    )
    def post(self, request):
        profile = profile_for_request(request)
        serializer = ExpenseCategoryCreateSerializer(
            data=request.data,
            context={"profile": profile},
        )
        serializer.is_valid(raise_exception=True)
        category = ExpenseCategory.objects.create(
            profile=profile,
            name=serializer.validated_data["name"],
            is_custom=True,
        )
        return Response(
            ExpenseCategorySerializer(category).data,
            status=status.HTTP_201_CREATED,
        )


# EN: List US1.6 expenses and persist confirmed US1.5/US1.7 entries.
# 中文：列出 US1.6 支出，并持久化已确认的 US1.5/US1.7 记录。
class ExpenseEntryListCreateView(APIView):

    @extend_schema(
        operation_id="expense_entries_list",
        summary="List recorded daily expenses",
        tags=["Expenses"],
        responses={200: ExpenseEntrySerializer(many=True)},
    )
    def get(self, request):
        profile = profile_for_request(request)
        return Response(ExpenseEntrySerializer(profile.expense_entries.all(), many=True).data)

    @extend_schema(
        operation_id="expense_entries_create",
        summary="Record a daily expense manually",
        tags=["Expenses"],
        request=ExpenseEntryCreateSerializer,
        responses={201: ExpenseEntrySerializer, 400: ApiErrorSerializer},
    )
    def post(self, request):
        profile = profile_for_request(request)
        serializer = ExpenseEntryCreateSerializer(
            data=request.data,
            context={"profile": profile},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        entry = ExpenseEntry.objects.create(
            profile=profile,
            category=profile.expense_categories.get(id=data["category_id"], is_active=True),
            expense_date=data["date"],
            amount=data["amount"],
            entry_method=data["entry_method"],
            merchant=data["merchant"],
            user_confirmed=True,
        )
        return Response(ExpenseEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


# EN: Create the unconfirmed, reviewable preview for US1.8.
# 中文：为 US1.8 创建尚未确认且可复核的预览。
class IncomeImportPreviewView(APIView):

    @extend_schema(
        operation_id="income_imports_preview",
        summary="Parse a CSV file into an unconfirmed income import preview",
        tags=["Income imports"],
        request=IncomeImportUploadSerializer,
        responses={201: IncomeImportBatchSerializer, 400: ApiErrorSerializer},
    )
    def post(self, request):
        profile = profile_for_request(request)
        serializer = IncomeImportUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = preview_income_import(
            profile=profile,
            uploaded_file=serializer.validated_data["file"],
        )
        return Response(
            IncomeImportBatchSerializer(batch).data,
            status=status.HTTP_201_CREATED,
        )


# EN: Retrieve only the current profile's US1.8 preview batch.
# 中文：只读取当前 profile 所有的 US1.8 预览批次。
class IncomeImportDetailView(APIView):

    @extend_schema(
        operation_id="income_imports_retrieve",
        summary="Retrieve an income import preview",
        tags=["Income imports"],
        responses={200: IncomeImportBatchSerializer, 404: ApiErrorSerializer},
    )
    def get(self, request, batch_id: int):
        profile = profile_for_request(request)
        batch = profile.income_import_batches.filter(id=batch_id).first()
        if batch is None:
            from rest_framework.exceptions import NotFound

            raise NotFound("Income import batch was not found for this profile.")
        return Response(IncomeImportBatchSerializer(batch).data)


# EN: Confirm recognised US1.8 rows before they enter financial analysis.
# 中文：在已识别 US1.8 行进入财务分析前完成确认。
class IncomeImportConfirmView(APIView):

    @extend_schema(
        operation_id="income_imports_confirm",
        summary="Confirm recognised rows and add them to income history",
        tags=["Income imports"],
        request=None,
        responses={
            200: IncomeImportBatchSerializer,
            400: ApiErrorSerializer,
            404: ApiErrorSerializer,
        },
    )
    def post(self, request, batch_id: int):
        profile = profile_for_request(request)
        batch = confirm_income_import(profile=profile, batch_id=batch_id)
        return Response(IncomeImportBatchSerializer(batch).data)
