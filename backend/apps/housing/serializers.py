from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from finance.services import profile_for_request

from .models import HousingCost, HousingScenario


class HousingCostSerializer(serializers.ModelSerializer):
    class Meta:
        model = HousingCost
        fields = ['id', 'category', 'amount']


class HousingScenarioSerializer(serializers.ModelSerializer):
    tenure_years = serializers.IntegerField(min_value=0, max_value=2147483647)
    additional_costs = HousingCostSerializer(many=True, required=False)
    financing_amount = serializers.SerializerMethodField()
    monthly_instalment = serializers.SerializerMethodField()
    total_monthly_cost = serializers.SerializerMethodField()

    class Meta:
        model = HousingScenario
        fields = [
            'id', 'property_price', 'deposit', 'financing_rate', 'tenure_years',
            'known_monthly_payment', 'additional_costs', 'financing_amount',
            'monthly_instalment', 'total_monthly_cost', 'created_at', 'updated_at',
        ]

    def validate_additional_costs(self, costs):
        categories = [cost['category'].strip().casefold() for cost in costs]
        if len(categories) != len(set(categories)):
            raise serializers.ValidationError(
                'Each additional housing-cost category must be unique.'
            )
        return costs

    @transaction.atomic
    def create(self, validated_data):
        costs = validated_data.pop('additional_costs', [])
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
        elif request:
            validated_data['profile'] = profile_for_request(request)
        else:
            raise serializers.ValidationError(
                'A request context is required to assign the scenario owner.'
            )
        scenario = HousingScenario.objects.create(**validated_data)
        for cost in costs:
            HousingCost.objects.create(scenario=scenario, **cost)
        return scenario

    @transaction.atomic
    def update(self, instance, validated_data):
        costs = validated_data.pop('additional_costs', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if costs is not None:
            instance.additional_costs.all().delete()
            for cost in costs:
                HousingCost.objects.create(scenario=instance, **cost)
        return instance

    def get_financing_amount(self, obj: HousingScenario) -> float:
        from .services import financing_amount
        return float(round(financing_amount(obj.property_price, obj.deposit), 2))

    def get_monthly_instalment(self, obj: HousingScenario) -> float:
        from .services import scenario_instalment
        return float(round(scenario_instalment(obj), 2))

    def get_total_monthly_cost(self, obj: HousingScenario) -> float:
        from .services import scenario_total_monthly_cost
        return float(round(scenario_total_monthly_cost(obj), 2))


class HousingCalculationCostSerializer(serializers.Serializer):
    category = serializers.CharField(max_length=100, required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)


class HousingCalculationSerializer(serializers.Serializer):
    property_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    deposit = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    financing_rate = serializers.DecimalField(max_digits=6, decimal_places=3, min_value=0)
    tenure_years = serializers.IntegerField(min_value=1)
    known_monthly_payment = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        allow_null=True,
        required=False,
    )
    additional_costs = HousingCalculationCostSerializer(many=True, required=False)
    cash_on_hand = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False, default=0
    )
    upfront_costs = HousingCalculationCostSerializer(many=True, required=False)


class PreHousingCheckSerializer(serializers.Serializer):
    """Accept the prototype payload while the server uses the session-owned record.

    The optional fields keep older clients source-compatible. They are deliberately
    not passed to the calculation service.
    """

    income = serializers.ListField(child=serializers.DictField(), required=False)
    work_costs = serializers.ListField(child=serializers.DictField(), required=False)
    commitments = serializers.DictField(required=False)
    expenses = serializers.ListField(child=serializers.DictField(), required=False)


class HousingCalculationResultSerializer(serializers.Serializer):
    financing_amount = serializers.FloatField()
    monthly_instalment = serializers.FloatField()
    total_monthly_cost = serializers.FloatField()
    upfront_required = serializers.FloatField(min_value=0)
    cash_on_hand = serializers.FloatField(min_value=0)
    upfront_gap = serializers.FloatField(min_value=0)


class PreHousingMonthResultSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)
    gross_income = serializers.FloatField()
    usable_income = serializers.FloatField()
    existing_costs = serializers.FloatField()
    surplus = serializers.FloatField()
    shortfall = serializers.FloatField(min_value=0)


class PreHousingWorstMonthSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)


class PreHousingCheckResultSerializer(serializers.Serializer):
    provenance = serializers.ChoiceField(choices=['calculated_from_user_record'])
    work_cost_basis = serializers.ChoiceField(choices=['recorded_entries_by_month'])
    has_existing_shortfall = serializers.BooleanField()
    tested_months = serializers.IntegerField(min_value=0)
    largest_existing_gap = serializers.FloatField(min_value=0)
    worst_month = PreHousingWorstMonthSerializer(allow_null=True)
    months = PreHousingMonthResultSerializer(many=True)

class HousingTestRequestSerializer(serializers.Serializer):
    scenario_id = serializers.IntegerField(min_value=1)
    tested_monthly_home_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False
    )
    income_shock_percent = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=0,
        max_value=90,
        required=False,
        default=0,
    )


class StatelessFinancialMonthSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)
    gross_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    usable_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    existing_costs = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)


class StatelessHousingTestRequestSerializer(HousingCalculationSerializer):
    financial_months = StatelessFinancialMonthSerializer(many=True, required=False)
    tested_monthly_home_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False
    )
    income_shock_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=0, max_value=90, required=False, default=0
    )


class SavedHousingTestPaymentMixin(serializers.Serializer):
    monthly_payment = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False
    )
    tested_monthly_home_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False, write_only=True
    )

    def validate(self, attrs):
        monthly_payment = attrs.get('monthly_payment')
        tested_home_cost = attrs.pop('tested_monthly_home_cost', None)
        if monthly_payment is not None and tested_home_cost is not None and monthly_payment != tested_home_cost:
            raise serializers.ValidationError(
                'monthly_payment and tested_monthly_home_cost must match when both are provided.'
            )
        if monthly_payment is None and tested_home_cost is not None:
            attrs['monthly_payment'] = tested_home_cost
        return attrs


class SavedHousingTestCreateSerializer(SavedHousingTestPaymentMixin):
    name = serializers.CharField(max_length=120, allow_blank=True, required=False, default='')
    scenario_id = serializers.IntegerField(min_value=1, allow_null=True, required=False)
    short_month_count = serializers.IntegerField(
        min_value=0, max_value=2147483647, required=False, default=0
    )
    tested_months = serializers.IntegerField(
        min_value=0, max_value=2147483647, required=False, default=0
    )
    largest_gap = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False, default=0
    )
    income_shock_percent = serializers.DecimalField(
        max_digits=6, decimal_places=2, min_value=0, max_value=90, required=False, default=0
    )
    result = serializers.DictField(required=False, default=dict)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        attrs.setdefault('monthly_payment', Decimal('0'))
        return attrs


class SavedHousingTestUpdateSerializer(SavedHousingTestPaymentMixin):
    name = serializers.CharField(max_length=120, allow_blank=True, required=False)


class SavedHousingTestResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    scenario_id = serializers.IntegerField(allow_null=True)
    property_price = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    monthly_payment = serializers.FloatField(min_value=0)
    tested_monthly_home_cost = serializers.FloatField(min_value=0)
    short_month_count = serializers.IntegerField(min_value=0)
    tested_months = serializers.IntegerField(min_value=0)
    largest_gap = serializers.FloatField(min_value=0)
    income_shock_percent = serializers.FloatField(min_value=0, max_value=90)
    scenario = serializers.DictField()
    result = serializers.DictField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class HousingTestMonthResultSerializer(PreHousingMonthResultSerializer):
    available_for_home = serializers.FloatField()
    tested_home_cost = serializers.FloatField(min_value=0)
    post_housing_residual = serializers.FloatField()
    is_short = serializers.BooleanField()
    existing_shortfall = serializers.FloatField(min_value=0)
    housing_created_shortfall = serializers.FloatField(min_value=0)
    housing_added_gap = serializers.FloatField(min_value=0)
    total_shortfall = serializers.FloatField(min_value=0)
    shortfall_type = serializers.ChoiceField(choices=[
        'none',
        'housing_created',
        'existing_and_worsened_by_housing',
    ])
    housing_shortfall = serializers.FloatField(min_value=0)


class CarryingRangeResultSerializer(serializers.Serializer):
    lower_monthly_amount = serializers.FloatField()
    upper_monthly_amount = serializers.FloatField()
    tested_monthly_home_cost = serializers.FloatField(min_value=0)
    lower_meaning = serializers.CharField()
    upper_meaning = serializers.CharField()
    indicative_property_price_lower = serializers.FloatField(min_value=0)
    indicative_property_price_upper = serializers.FloatField(min_value=0)
    property_price_limitation = serializers.CharField()


class StartingLiquidityMonthResultSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)
    closing_balance = serializers.FloatField()


class StartingLiquidityMonthReferenceSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)


class StartingLiquidityResultSerializer(serializers.Serializer):
    required_amount = serializers.FloatField(min_value=0)
    months = StartingLiquidityMonthResultSerializer(many=True)
    fall_start = StartingLiquidityMonthReferenceSerializer(
        allow_null=True,
        help_text="Month whose closing balance is the high the deepest fall starts from; null when it starts at the beginning of the record.",
    )
    fall_end = StartingLiquidityMonthReferenceSerializer(
        allow_null=True,
        help_text="Month where the deepest fall reaches its lowest balance; null when the balance never falls.",
    )


class HousingTestResultSerializer(serializers.Serializer):
    scenario_id = serializers.IntegerField(min_value=0)
    tested_home_cost = serializers.FloatField(min_value=0)
    indicative_tested_property_price = serializers.FloatField(min_value=0, required=False)
    income_shock_percent = serializers.FloatField(min_value=0, max_value=90)
    tested_months = serializers.IntegerField(min_value=0)
    short_month_count = serializers.IntegerField(min_value=0)
    existing_short_month_count = serializers.IntegerField(min_value=0)
    housing_created_short_month_count = serializers.IntegerField(min_value=0)
    largest_gap = serializers.FloatField(min_value=0)
    largest_existing_gap = serializers.FloatField(min_value=0)
    largest_housing_created_gap = serializers.FloatField(min_value=0)
    months = HousingTestMonthResultSerializer(many=True)
    carrying_range = CarryingRangeResultSerializer(allow_null=True)
    starting_liquidity = StartingLiquidityResultSerializer()

