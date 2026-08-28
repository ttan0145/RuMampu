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
    IncomeSource,
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
    IncomeImportBatchSerializer,
    IncomeImportUploadSerializer,
    IncomeRecordSerializer,
    IncomeSourceCreateSerializer,
    IncomeSourceSerializer,
    WorkCostItemCreateSerializer,
    WorkCostItemSerializer,
    WorkCostItemUpdateSerializer,
)
from .services import create_income_entry, is_unusually_high, profile_for_income_request, profile_for_request


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


class IncomeEntryListCreateView(APIView):
    @extend_schema(
        operation_id="income_entries_list",
        summary="List income entries",
        tags=["Income"],
        responses={200: IncomeEntrySerializer(many=True)},
    )
    def get(self, request):
        profile = profile_for_income_request(request)
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
        profile = profile_for_income_request(request)
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


class WorkCostItemListCreateView(APIView):
    @extend_schema(
        operation_id="work_cost_items_list",
        summary="List active monthly work-cost items",
        tags=["Work costs"],
        responses={200: WorkCostItemSerializer(many=True)},
    )
    def get(self, request):
        profile = profile_for_request(request)
        items = profile.work_cost_items.filter(is_active=True)
        return Response(WorkCostItemSerializer(items, many=True).data)

    @extend_schema(
        operation_id="work_cost_items_create",
        summary="Create a custom monthly work-cost item",
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
            monthly_amount=serializer.validated_data["monthly_amount"],
            is_custom=True,
        )
        return Response(WorkCostItemSerializer(item).data, status=status.HTTP_201_CREATED)


class WorkCostItemDetailView(APIView):
    @extend_schema(
        operation_id="work_cost_items_update",
        summary="Update a monthly work-cost amount",
        tags=["Work costs"],
        request=WorkCostItemUpdateSerializer,
        responses={
            200: WorkCostItemSerializer,
            400: ApiErrorSerializer,
            404: ApiErrorSerializer,
        },
    )
    def patch(self, request, item_id: int):
        profile = profile_for_request(request)
        item = profile.work_cost_items.filter(id=item_id, is_active=True).first()
        if item is None:
            from rest_framework.exceptions import NotFound

            raise NotFound("Work-cost item was not found for this profile.")
        serializer = WorkCostItemUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item.monthly_amount = serializer.validated_data["monthly_amount"]
        item.save(update_fields=["monthly_amount", "updated_at"])
        return Response(WorkCostItemSerializer(item).data)


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
